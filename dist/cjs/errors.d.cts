import { TanStackDBError } from '@tanstack/db';
export declare class CouchDBCollectionError extends TanStackDBError {
    constructor(message: string);
}
export declare class CouchDBRequestFailedError extends CouchDBCollectionError {
    constructor(error: unknown);
}
export declare class InitialSyncFailedError extends CouchDBCollectionError {
    constructor(error: unknown);
}
export declare class TimeoutWaitingForUpdateError extends CouchDBCollectionError {
    constructor(ids: string[]);
}
export declare class TimeoutWaitingForInsertError extends CouchDBCollectionError {
    constructor(ids: string[]);
}
export declare class TimeoutWaitingForDeleteError extends CouchDBCollectionError {
    constructor(ids: string[]);
}
export declare class DocumentNotFoundError extends CouchDBCollectionError {
    constructor(id: string);
}
export declare class NoIDProvidedError extends CouchDBCollectionError {
    constructor(object: object);
}
export declare class NoRevFoundForDocumentError extends CouchDBCollectionError {
    constructor(object: object);
}
export declare class RevDefinedOnInsert extends CouchDBCollectionError {
    constructor(object: object);
}
