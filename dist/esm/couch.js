import { Store } from "@tanstack/store";
import { TimeoutWaitingForInsertError, NoIDProvidedError, TimeoutWaitingForUpdateError, DocumentNotFoundError, TimeoutWaitingForDeleteError, CouchDBCollectionError, CouchDBRequestFailedError, InitialSyncFailedError } from "./errors.js";
const rejectAfterSleep = (sleepTime, error) => new Promise((_resolve, reject) => {
  setTimeout(() => {
    reject(error);
  }, sleepTime);
});
const createChangeTrackingId = (id, rev) => `${id}:${rev}`;
function couchDBCollectionOptions({
  couch: {
    db,
    mutationTimeout = 1e4,
    filter = (doc) => !doc._id.startsWith("_"),
    attachments = false,
    binary = false
  },
  ...config
}) {
  const seenDocumentIds = new Store(/* @__PURE__ */ new Set());
  const awaitDocumentUpdate = (trackingId) => {
    if (seenDocumentIds.state.has(trackingId)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const unsubscribe = seenDocumentIds.subscribe(() => {
        if (seenDocumentIds.state.has(trackingId)) {
          seenDocumentIds.state.delete(trackingId);
          unsubscribe();
          resolve(true);
        }
      });
    });
  };
  const sync = (params) => {
    const {
      begin,
      write: unfilteredWrite,
      commit,
      markReady,
      collection
    } = params;
    const write = (event) => filter(event.value) ? unfilteredWrite(event) : void 0;
    const eventBuffer = [];
    let isInitialSyncComplete = false;
    const pouchChangeListener = db.changes({
      since: "now",
      live: true,
      include_docs: true,
      attachments,
      binary
    }).on("change", (change) => {
      if (!change.doc) {
        throw new CouchDBCollectionError(
          "Doc was not returned with the change, THIS SHOULD NEVER HAPPEN"
        );
      }
      const doc = change.doc;
      let operationType = "update";
      if (change.deleted) operationType = "delete";
      else if (collection.get(doc._id) == null) operationType = "insert";
      if (!isInitialSyncComplete) {
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
    async function initialSync() {
      try {
        const data = await db.allDocs({
          include_docs: true,
          attachments,
          binary
        });
        begin();
        for (const item of data.rows) {
          if (!item.doc)
            throw new CouchDBCollectionError(
              "Doc was not returned when retrieving all docs, THIS SHOULD NEVER HAPPEN"
            );
          write({
            type: "insert",
            value: item.doc
          });
        }
        commit();
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
        markReady();
      }
    }
    initialSync();
    return () => pouchChangeListener.cancel();
  };
  const handleCouchUpdate = async (handler) => {
    let res = void 0;
    try {
      res = await handler();
    } catch (e) {
      throw new CouchDBRequestFailedError(e);
    }
    const trackingId = createChangeTrackingId(res.id, res.rev);
    await awaitDocumentUpdate(trackingId);
  };
  const promiseAllWithTimeout = (ps, error) => Promise.race([
    mutationTimeout && rejectAfterSleep(mutationTimeout, error),
    Promise.all(ps)
  ]);
  return {
    id: config.id,
    getKey: (item) => item._id,
    schema: config.schema,
    sync: { sync, rowUpdateMode: "full" },
    onDelete: async ({ transaction, collection }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);
          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new DocumentNotFoundError(mutation.changes._id);
          await handleCouchUpdate(async () => db.remove(doc._id, doc._rev));
        }),
        new TimeoutWaitingForDeleteError(
          transaction.mutations.map((mut) => mut.changes._id)
        )
      );
    },
    onUpdate: async ({ transaction, collection }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);
          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new DocumentNotFoundError(mutation.changes._id);
          await handleCouchUpdate(
            () => db.put({ ...mutation.changes, _rev: doc._rev })
          );
        }),
        new TimeoutWaitingForUpdateError(
          transaction.mutations.map((mut) => mut.changes._id)
        )
      );
    },
    onInsert: async ({ transaction }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);
          await handleCouchUpdate(async () => db.put(mutation.changes));
        }),
        new TimeoutWaitingForInsertError(
          transaction.mutations.map((mut) => mut.changes._id)
        )
      );
    }
  };
}
export {
  couchDBCollectionOptions
};
//# sourceMappingURL=couch.js.map
