import { CollectionConfig, ResolveType } from '@tanstack/db';
import { StandardSchemaV1 } from '@standard-schema/spec';
export type CouchDBCollectionDoc = PouchDB.Core.Document<PouchDB.Core.AllDocsMeta & PouchDB.Core.IdMeta & Partial<PouchDB.Core.RevisionIdMeta>>;
export interface CouchDBCollectionConfig<TExplicit extends unknown = unknown, TSchema extends StandardSchemaV1 = never, TFallback extends CouchDBCollectionDoc = CouchDBCollectionDoc> extends Omit<CollectionConfig<ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc, string, TSchema>, "onInsert" | "onUpdate" | "onDelete" | "sync" | "getKey"> {
    couch: {
        db: PouchDB.Database;
        filter?: (doc: CouchDBCollectionDoc & object) => boolean;
        attachments?: boolean;
        binary?: boolean;
        mutationTimeout?: number;
    };
}
export declare function couchDBCollectionOptions<TExplicit extends unknown = unknown, TSchema extends StandardSchemaV1 = never, TFallback extends CouchDBCollectionDoc = CouchDBCollectionDoc>({ couch: { db, mutationTimeout, filter, attachments, binary, }, ...config }: CouchDBCollectionConfig<TExplicit, TSchema, TFallback>): CollectionConfig<ResolveType<TExplicit, TSchema, TFallback> & CouchDBCollectionDoc, string, TSchema>;
