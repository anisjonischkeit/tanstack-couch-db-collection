import { TanStackDBError } from "@tanstack/db";
class CouchDBCollectionError extends TanStackDBError {
  constructor(message) {
    super(message);
    this.name = `ElectricDBCollectionError`;
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
    super(`Timeout waiting for delete of ids: ${ids}`);
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
    this.name = `NoIDProvidedForUpdateError`;
  }
}
class NoIDProvidedError extends CouchDBCollectionError {
  constructor(object) {
    super(`_id field was not provided for ${object}`);
    this.name = `NoIDProvidedForUpdateError`;
  }
}
export {
  CouchDBCollectionError,
  CouchDBRequestFailedError,
  DocumentNotFoundError,
  InitialSyncFailedError,
  NoIDProvidedError,
  TimeoutWaitingForDeleteError,
  TimeoutWaitingForInsertError,
  TimeoutWaitingForUpdateError
};
//# sourceMappingURL=errors.js.map
