import { CollectionConfig, OperationType, ResolveType } from "@tanstack/db";
import { Store } from "@tanstack/store";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  CouchDBCollectionError,
  CouchDBRequestFailedError,
  DocumentNotFoundError,
  InitialSyncFailedError,
  NoIDProvidedError,
  NoRevFoundForDocumentError,
  RevDefinedOnInsert,
  TimeoutWaitingForDeleteError,
  TimeoutWaitingForInsertError,
  TimeoutWaitingForUpdateError,
} from "./errors";

export type CouchDBCollectionDoc = PouchDB.Core.Document<
  PouchDB.Core.AllDocsMeta &
    PouchDB.Core.IdMeta &
    // Revision ID is nullable here since on an initial insert, there will be no
    // _rev field, since that field is set by couch db. The optimistic state will
    // not have this _rev field until data is synced back to the Tanstack collection
    // from couchdb
    Partial<PouchDB.Core.RevisionIdMeta>
>;

export interface CouchDBCollectionConfig<
  TExplicit extends unknown = unknown,
  TSchema extends StandardSchemaV1 = never,
  TFallback extends CouchDBCollectionDoc = CouchDBCollectionDoc,
> extends Omit<
    CollectionConfig<
      ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc,
      string,
      TSchema
    >,
    "onInsert" | "onUpdate" | "onDelete" | "sync" | "getKey"
  > {
  couch: {
    db: PouchDB.Database;
    filter?: (doc: CouchDBCollectionDoc & object) => boolean;
    attachments?: boolean;
    changeListenerOptions?: Partial<PouchDB.Core.ChangesOptions>;
    binary?: boolean;
    mutationTimeout?: number;
  };
}

const rejectAfterSleep = (sleepTime: number, error: CouchDBCollectionError) =>
  new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(error);
    }, sleepTime);
  });

const createChangeTrackingId = (id: string, rev: string) => `${id}:${rev}`;

export function couchDBCollectionOptions<
  TExplicit extends unknown = unknown,
  TSchema extends StandardSchemaV1 = never,
  TFallback extends CouchDBCollectionDoc = CouchDBCollectionDoc,
>({
  couch: {
    db,
    mutationTimeout = 10_000,
    filter = (doc) => !doc._id.startsWith("_"),
    changeListenerOptions = {},
    attachments = false,
    binary = false,
  },
  ...config
}: CouchDBCollectionConfig<TExplicit, TSchema, TFallback>): CollectionConfig<
  ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc,
  string,
  TSchema
> {
  const seenDocumentIds = new Store<Set<string>>(new Set());
  const awaitDocumentUpdate = (trackingId: string): Promise<boolean> => {
    if (seenDocumentIds.state.has(trackingId)) return Promise.resolve(true);

    return new Promise((resolve) => {
      const unsubscribe = seenDocumentIds.subscribe(() => {
        if (seenDocumentIds.state.has(trackingId)) {
          // is this safe?
          seenDocumentIds.state.delete(trackingId);

          unsubscribe();
          resolve(true);
        }
      });
    });
  };

  const sync: CollectionConfig<
    ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc,
    string,
    TSchema
  >[`sync`][`sync`] = (params) => {
    const {
      begin,
      write: unfilteredWrite,
      commit,
      markReady,
      collection,
    } = params;
    const write: typeof unfilteredWrite = (event) =>
      filter(event.value) ? unfilteredWrite(event) : undefined;

    const eventBuffer: Array<{
      type: OperationType;
      value: ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc;
    }> = [];
    let isInitialSyncComplete = false;

    // 1. Initialize connection to sync engine
    const pouchChangeListener = db
      .changes<
        ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc
      >({
        since: "now",
        live: true,
        include_docs: true,
        attachments,
        binary,
        ...changeListenerOptions,
      })
      .on("change", (change) => {
        if (!change.doc) {
          throw new CouchDBCollectionError(
            "Doc was not returned with the change, THIS SHOULD NEVER HAPPEN",
          );
        }
        const doc = change.doc;

        let operationType: OperationType = "update";
        if (change.deleted) operationType = "delete";
        else if (collection.get(doc._id) == null) operationType = "insert";

        if (!isInitialSyncComplete) {
          // Buffer events during initial sync to prevent race conditions
          eventBuffer.push({ type: operationType, value: doc });
          return;
        }

        begin();

        seenDocumentIds.setState((prevState) => {
          return prevState.add(createChangeTrackingId(doc._id, doc._rev));
        });
        write({ type: operationType, value: doc });

        commit();
      });

    // 3. Perform initial data fetch
    async function initialSync() {
      try {
        const data = await db.allDocs<
          ResolveType<TExplicit, TSchema, TFallback>
        >({
          include_docs: true,
          attachments,
          binary,
        });

        begin(); // Start a transaction

        for (const item of data.rows) {
          if (!item.doc)
            throw new CouchDBCollectionError(
              "Doc was not returned when retrieving all docs, THIS SHOULD NEVER HAPPEN",
            );
          write({
            type: "insert",
            value: item.doc,
          });
        }

        commit(); // Commit the transaction

        // 4. Process buffered events
        isInitialSyncComplete = true;
        if (eventBuffer.length > 0) {
          begin();

          for (const event of eventBuffer) {
            write(event);
          }
          commit();
          eventBuffer.splice(0);
        }
      } catch (error) {
        throw new InitialSyncFailedError(error);
      } finally {
        // ALWAYS call markReady, even on error
        markReady();
      }
    }

    initialSync();

    return () => pouchChangeListener.cancel();
  };

  const handleCouchUpdate = async (
    handler: () => Promise<PouchDB.Core.Response>,
  ) => {
    let res = undefined;
    try {
      res = await handler();
    } catch (e) {
      throw new CouchDBRequestFailedError(e);
    }

    const trackingId = createChangeTrackingId(res.id, res.rev);
    await awaitDocumentUpdate(trackingId);
  };

  const promiseAllWithTimeout = (
    ps: Promise<any>[],
    error: CouchDBCollectionError,
  ) =>
    Promise.race([
      mutationTimeout && rejectAfterSleep(mutationTimeout, error),
      Promise.all(ps),
    ]);

  return {
    id: config.id,
    getKey: (item) => item._id,
    schema: config.schema,
    sync: { sync, rowUpdateMode: "full" },
    onDelete: async ({ transaction, collection }) => {
      // We must get the doc as a deletion requires a revision id
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);

          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new DocumentNotFoundError(mutation.changes._id);
          if (!doc._rev) throw new NoRevFoundForDocumentError(doc);
          const id = doc._id;
          const rev = doc._rev;

          await handleCouchUpdate(() => db.remove(id, rev));
        }),
        new TimeoutWaitingForDeleteError(
          transaction.mutations.map((mut) => mut.changes._id!),
        ),
      );
    },
    onUpdate: async ({ transaction, collection }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);

          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new DocumentNotFoundError(mutation.changes._id);

          await handleCouchUpdate(() =>
            db.put({ ...mutation.changes, _rev: doc._rev }),
          );
        }),
        new TimeoutWaitingForUpdateError(
          transaction.mutations.map((mut) => mut.changes._id!),
        ),
      );
    },
    onInsert: async ({ transaction }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);
          if (mutation.changes._rev)
            throw new RevDefinedOnInsert(mutation.changes);

          await handleCouchUpdate(() => db.put(mutation.changes));
        }),

        new TimeoutWaitingForInsertError(
          transaction.mutations.map((mut) => mut.changes._id!),
        ),
      );
    },
  };
}
