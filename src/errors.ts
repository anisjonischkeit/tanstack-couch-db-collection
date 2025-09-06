import { TanStackDBError } from "@tanstack/db";

export class CouchDBCollectionError extends TanStackDBError {
  constructor(message: string) {
    super(message);
    this.name = `CouchDBCollectionError`;
  }
}

export class CouchDBRequestFailedError extends CouchDBCollectionError {
  constructor(error: unknown) {
    super(`Request to CouchDB instance failed with error ${error}`);
    this.name = `CouchDBRequestFailedError`;
  }
}

export class InitialSyncFailedError extends CouchDBCollectionError {
  constructor(error: unknown) {
    super(`Initial sync failed with error ${error}`);
    this.name = `InitialSyncFailedError`;
  }
}

export class TimeoutWaitingForUpdateError extends CouchDBCollectionError {
  constructor(ids: string[]) {
    super(`Timeout waiting for update of ids: ${ids}`);
    this.name = `TimeoutWaitingForUpdateError`;
  }
}

export class TimeoutWaitingForInsertError extends CouchDBCollectionError {
  constructor(ids: string[]) {
    super(`Timeout waiting for insert of ids: ${ids}`);
    this.name = `TimeoutWaitingForInsertError`;
  }
}

export class TimeoutWaitingForDeleteError extends CouchDBCollectionError {
  constructor(ids: string[]) {
    super(`Timeout waiting for delete of ids: ${ids}`);
    this.name = `TimeoutWaitingForDeleteError`;
  }
}

export class DocumentNotFoundError extends CouchDBCollectionError {
  constructor(id: string) {
    super(`No document was found for id ${id}`);
    this.name = `DocumentNotFoundError`;
  }
}

export class NoIDProvidedError extends CouchDBCollectionError {
  constructor(object: object) {
    super(`_id field was not provided for ${object}`);
    this.name = `NoIDProvidedForUpdateError`;
  }
}
export class NoRevFoundForDocumentError extends CouchDBCollectionError {
  constructor(object: object) {
    super(
      `_rev field was not found for ${object}. This likely means the value from the database hasn't been synced to the TanstackDB collection`,
    );
    this.name = `NoRevFoundForDocumentError`;
  }
}

export class RevDefinedOnInsert extends CouchDBCollectionError {
  constructor(object: object) {
    super(
      `_rev field was defined on insert of ${object}. This field is only allowed on updates and deletes`,
    );
    this.name = `RevDefinedOnInsert`;
  }
}
