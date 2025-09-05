import { CollectionConfig, ResolveType } from '@tanstack/db';
import { StandardSchemaV1 } from '@standard-schema/spec';
type PouchDBCoreDoc = PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta>;
export interface CouchDBCollectionConfig<TExplicit extends unknown = unknown, TSchema extends StandardSchemaV1 = never, TFallback extends PouchDBCoreDoc = PouchDBCoreDoc> extends Omit<CollectionConfig<ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc>, "onInsert" | "onUpdate" | "onDelete" | "sync" | "getKey"> {
    db: PouchDB.Database;
    mutationTimeout?: number;
}
export declare function couchDBCollectionOptions<TExplicit extends unknown = unknown, TSchema extends StandardSchemaV1 = never, TFallback extends PouchDBCoreDoc = PouchDBCoreDoc>(config: CouchDBCollectionConfig<TExplicit, TSchema, TFallback>): CollectionConfig<ResolveType<TExplicit, TSchema, TFallback> & PouchDBCoreDoc>;
export {};
