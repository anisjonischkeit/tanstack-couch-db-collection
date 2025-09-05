"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const couch = require("./couch.cjs");
const errors = require("./errors.cjs");
exports.couchDBCollectionOptions = couch.couchDBCollectionOptions;
exports.CouchDBCollectionError = errors.CouchDBCollectionError;
exports.CouchDBRequestFailedError = errors.CouchDBRequestFailedError;
exports.DocumentNotFoundError = errors.DocumentNotFoundError;
exports.InitialSyncFailedError = errors.InitialSyncFailedError;
exports.NoIDProvidedError = errors.NoIDProvidedError;
exports.TimeoutWaitingForDeleteError = errors.TimeoutWaitingForDeleteError;
exports.TimeoutWaitingForInsertError = errors.TimeoutWaitingForInsertError;
exports.TimeoutWaitingForUpdateError = errors.TimeoutWaitingForUpdateError;
//# sourceMappingURL=index.cjs.map
