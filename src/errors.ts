import { TanStackDBError } from "@tanstack/db";

export class CouchDBCollectionError extends TanStackDBError {
  constructor(message: string) {
    super(message);
    this.name = `ElectricDBCollectionError`;
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
    super(`Timeout waiting for delete of ids: ${ids}`);
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
    this.name = `NoIDProvidedForUpdateError`;
  }
}

export class NoIDProvidedError extends CouchDBCollectionError {
  constructor(object: object) {
    super(`_id field was not provided for ${object}`);
    this.name = `NoIDProvidedForUpdateError`;
  }
}
