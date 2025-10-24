"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const store = require("@tanstack/store");
const errors = require("./errors.cjs");
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
    changeListenerOptions = {},
    attachments = false,
    binary = false
  },
  ...config
}) {
  const seenDocumentIds = new store.Store(/* @__PURE__ */ new Set());
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
      binary,
      ...changeListenerOptions
    }).on("change", (change) => {
      if (!change.doc) {
        throw new errors.CouchDBCollectionError(
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
            throw new errors.CouchDBCollectionError(
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
        throw new errors.InitialSyncFailedError(error);
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
      throw new errors.CouchDBRequestFailedError(e);
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
            throw new errors.NoIDProvidedError(mutation.changes);
          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new errors.DocumentNotFoundError(mutation.changes._id);
          if (!doc._rev) throw new errors.NoRevFoundForDocumentError(doc);
          const id = doc._id;
          const rev = doc._rev;
          await handleCouchUpdate(() => db.remove(id, rev));
        }),
        new errors.TimeoutWaitingForDeleteError(
          transaction.mutations.map((mut) => mut.changes._id)
        )
      );
    },
    onUpdate: async ({ transaction, collection }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new errors.NoIDProvidedError(mutation.changes);
          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new errors.DocumentNotFoundError(mutation.changes._id);
          await handleCouchUpdate(
            () => db.put({ ...mutation.changes, _rev: doc._rev })
          );
        }),
        new errors.TimeoutWaitingForUpdateError(
          transaction.mutations.map((mut) => mut.changes._id)
        )
      );
    },
    onInsert: async ({ transaction }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new errors.NoIDProvidedError(mutation.changes);
          if (mutation.changes._rev)
            throw new errors.RevDefinedOnInsert(mutation.changes);
          await handleCouchUpdate(() => db.put(mutation.changes));
        }),
        new errors.TimeoutWaitingForInsertError(
          transaction.mutations.map((mut) => mut.changes._id)
        )
      );
    }
  };
}
exports.couchDBCollectionOptions = couchDBCollectionOptions;
//# sourceMappingURL=couch.cjs.map
