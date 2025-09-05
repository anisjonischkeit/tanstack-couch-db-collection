import { CollectionConfig, OperationType, ResolveType } from "@tanstack/db";
import { Store } from "@tanstack/store";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  CouchDBCollectionError,
  CouchDBRequestFailedError,
  DocumentNotFoundError,
  InitialSyncFailedError,
  NoIDProvidedError,
  TimeoutWaitingForDeleteError,
  TimeoutWaitingForInsertError,
  TimeoutWaitingForUpdateError,
} from "./errors";

type PouchDBCoreDoc = PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta>;

export interface CouchDBCollectionConfig<
  TExplicit extends unknown = unknown,
  TSchema extends StandardSchemaV1 = never,
  TFallback extends PouchDBCoreDoc = PouchDBCoreDoc,
> extends Omit<
    CollectionConfig<
      ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc
    >,
    "onInsert" | "onUpdate" | "onDelete" | "sync" | "getKey"
  > {
  db: PouchDB.Database;
  mutationTimeout?: number;
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
  TFallback extends PouchDBCoreDoc = PouchDBCoreDoc,
>(
  config: CouchDBCollectionConfig<TExplicit, TSchema, TFallback>,
): CollectionConfig<
  ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc
> {
  const createWriteData = (change: {
    deleted?: boolean;
    doc: ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc;
  }): {
    type: OperationType;
    value: ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc;
  } => {
    if (change.deleted) {
      return {
        type: "delete",
        value: change.doc,
      };
    } else {
      // Check the revision number to distinguish insert from update
      if (change.doc!._rev.startsWith("1-")) {
        return {
          type: "insert",
          value: change.doc,
        };
      } else {
        return {
          type: "update",
          value: change.doc,
        };
      }
    }
  };

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
    ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc
  >[`sync`][`sync`] = (params) => {
    const { begin, write, commit, markReady, collection } = params;

    const eventBuffer: Array<any> = [];
    let isInitialSyncComplete = false;

    // 1. Initialize connection to sync engine
    const pouchChangeListener = config.db
      .changes<ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc>({
        since: "now",
        live: true,
        include_docs: true,
      })
      .on("change", (change) => {
        if (!change.doc) {
          throw new CouchDBCollectionError(
            "Doc was not returned with the change, THIS SHOULD NEVER HAPPEN",
          );
        }
        const doc = change.doc;

        if (!isInitialSyncComplete) {
          // Buffer events during initial sync to prevent race conditions
          eventBuffer.push(change);
          return;
        }

        begin();

        seenDocumentIds.setState((prevState) => {
          return prevState.add(createChangeTrackingId(doc._id, doc._rev));
        });
        write(
          createWriteData({
            deleted: change.deleted,
            doc: doc,
          }),
        );

        commit();
      });

    // 3. Perform initial data fetch
    async function initialSync() {
      try {
        const data = await config.db.allDocs<
          ResolveType<TExplicit, TSchema, TFallback>
        >({
          include_docs: true,
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
      config.mutationTimeout !== null &&
        rejectAfterSleep(config.mutationTimeout || 10000, error),
      Promise.all(ps),
    ]);

  return {
    id: config.id,
    getKey: (item) => item._id,
    schema: config.schema,
    sync: { sync },
    onDelete: async ({ transaction, collection }) => {
      // We must get the doc as a deletion requires a revision id
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);

          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new DocumentNotFoundError(mutation.changes._id);

          await handleCouchUpdate(async () =>
            config.db.remove(doc._id, doc._rev),
          );
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
            config.db.put(transaction.mutations[0].changes),
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

          await handleCouchUpdate(async () => config.db.put(mutation.changes));
        }),

        new TimeoutWaitingForInsertError(
          transaction.mutations.map((mut) => mut.changes._id!),
        ),
      );
    },
  };
}
