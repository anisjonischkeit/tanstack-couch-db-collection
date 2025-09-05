import { Store } from "@tanstack/store";
import { TimeoutWaitingForInsertError, NoIDProvidedError, TimeoutWaitingForUpdateError, DocumentNotFoundError, TimeoutWaitingForDeleteError, CouchDBCollectionError, CouchDBRequestFailedError, InitialSyncFailedError } from "./errors.js";
const rejectAfterSleep = (sleepTime, error) => new Promise((_resolve, reject) => {
  setTimeout(() => {
    reject(error);
  }, sleepTime);
});
const createChangeTrackingId = (id, rev) => `${id}:${rev}`;
function couchDBCollectionOptions(config) {
  const createWriteData = (change) => {
    if (change.deleted) {
      return {
        type: "delete",
        value: change.doc
      };
    } else {
      if (change.doc._rev.startsWith("1-")) {
        return {
          type: "insert",
          value: change.doc
        };
      } else {
        return {
          type: "update",
          value: change.doc
        };
      }
    }
  };
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
    const { begin, write, commit, markReady, collection } = params;
    const eventBuffer = [];
    let isInitialSyncComplete = false;
    const pouchChangeListener = config.db.changes({
      since: "now",
      live: true,
      include_docs: true
    }).on("change", (change) => {
      if (!change.doc) {
        throw new CouchDBCollectionError(
          "Doc was not returned with the change, THIS SHOULD NEVER HAPPEN"
        );
      }
      const doc = change.doc;
      if (!isInitialSyncComplete) {
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
          doc
        })
      );
      commit();
    });
    async function initialSync() {
      try {
        const data = await config.db.allDocs({
          include_docs: true
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
    config.mutationTimeout !== null && rejectAfterSleep(config.mutationTimeout || 1e4, error),
    Promise.all(ps)
  ]);
  return {
    id: config.id,
    getKey: (item) => item._id,
    schema: config.schema,
    sync: { sync },
    onDelete: async ({ transaction, collection }) => {
      await promiseAllWithTimeout(
        transaction.mutations.map(async (mutation) => {
          if (!mutation.changes._id)
            throw new NoIDProvidedError(mutation.changes);
          const doc = collection.get(mutation.changes._id);
          if (!doc) throw new DocumentNotFoundError(mutation.changes._id);
          await handleCouchUpdate(
            async () => config.db.remove(doc._id, doc._rev)
          );
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
            () => config.db.put(transaction.mutations[0].changes)
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
          await handleCouchUpdate(async () => config.db.put(mutation.changes));
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
