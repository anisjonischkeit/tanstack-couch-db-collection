import { TanStackDBError } from "@tanstack/db";
class CouchDBCollectionError extends TanStackDBError {
  constructor(message) {
    super(message);
    this.name = `CouchDBCollectionError`;
  }
}
class CouchDBRequestFailedError extends CouchDBCollectionError {
  constructor(error) {
    super(`Request to CouchDB instance failed with error ${error}`);
    this.name = `CouchDBRequestFailedError`;
  }
}
class InitialSyncFailedError extends CouchDBCollectionError {
  constructor(error) {
    super(`Initial sync failed with error ${error}`);
    this.name = `InitialSyncFailedError`;
  }
}
class TimeoutWaitingForUpdateError extends CouchDBCollectionError {
  constructor(ids) {
    super(`Timeout waiting for update of ids: ${ids}`);
    this.name = `TimeoutWaitingForUpdateError`;
  }
}
class TimeoutWaitingForInsertError extends CouchDBCollectionError {
  constructor(ids) {
    super(`Timeout waiting for insert of ids: ${ids}`);
    this.name = `TimeoutWaitingForInsertError`;
  }
}
class TimeoutWaitingForDeleteError extends CouchDBCollectionError {
  constructor(ids) {
    super(`Timeout waiting for delete of ids: ${ids}`);
    this.name = `TimeoutWaitingForDeleteError`;
  }
}
class DocumentNotFoundError extends CouchDBCollectionError {
  constructor(id) {
    super(`No document was found for id ${id}`);
    this.name = `DocumentNotFoundError`;
  }
}
class NoIDProvidedError extends CouchDBCollectionError {
  constructor(object) {
    super(`_id field was not provided for ${object}`);
    this.name = `NoIDProvidedForUpdateError`;
  }
}
class NoRevFoundForDocumentError extends CouchDBCollectionError {
  constructor(object) {
    super(
      `_rev field was not found for ${object}. This likely means the value from the database hasn't been synced to the TanstackDB collection`
    );
    this.name = `NoRevFoundForDocumentError`;
  }
}
class RevDefinedOnInsert extends CouchDBCollectionError {
  constructor(object) {
    super(
      `_rev field was defined on insert of ${object}. This field is only allowed on updates and deletes`
    );
    this.name = `RevDefinedOnInsert`;
  }
}
export {
  CouchDBCollectionError,
  CouchDBRequestFailedError,
  DocumentNotFoundError,
  InitialSyncFailedError,
  NoIDProvidedError,
  NoRevFoundForDocumentError,
  RevDefinedOnInsert,
  TimeoutWaitingForDeleteError,
  TimeoutWaitingForInsertError,
  TimeoutWaitingForUpdateError
};
//# sourceMappingURL=errors.js.map
