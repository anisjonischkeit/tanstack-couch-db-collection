import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  createCollection,
  createLiveQueryCollection,
  eq,
  gt,
} from "@tanstack/db";
import { couchDBCollectionOptions } from "../src/couch";
import type { CouchDBCollectionDoc } from "../src/couch";
import PouchDB from "pouchdb";
import type { ResolveType } from "@tanstack/db";

describe(`Couch collection type resolution tests`, () => {
  // Define test types
  type ExplicitType = { id: string; explicit: boolean };
  type FallbackType = CouchDBCollectionDoc;

  // Define a schema
  const testSchema = z.object({
    id: z.string(),
    schema: z.boolean(),
  });
  const db = new PouchDB("local");

  type SchemaType = z.infer<typeof testSchema>;

  it(`should prioritize explicit type in CouchDBCollectionConfig`, () => {
    const options = couchDBCollectionOptions<ExplicitType>({
      couch: {
        db,
      },
    });

    type ExpectedType = ResolveType<ExplicitType, never, CouchDBCollectionDoc>;
    // The getKey function should have the resolved type
    expectTypeOf(options.getKey).parameters.toEqualTypeOf<
      [ExplicitType & CouchDBCollectionDoc]
    >();
    expectTypeOf<ExpectedType>().toEqualTypeOf<ExplicitType>();
  });

  it(`should use schema type when explicit type is not provided`, () => {
    const options = couchDBCollectionOptions({
      couch: {
        db,
      },
      schema: testSchema,
    });

    type ExpectedType = ResolveType<
      unknown,
      typeof testSchema,
      CouchDBCollectionDoc
    >;
    // The getKey function should have the resolved type
    expectTypeOf(options.getKey).parameters.toEqualTypeOf<
      [SchemaType & CouchDBCollectionDoc]
    >();
    expectTypeOf<ExpectedType>().toEqualTypeOf<SchemaType>();
  });

  it(`should use fallback type when neither explicit nor schema type is provided`, () => {
    const config = {
      couch: {
        db,
      },
    };

    const options = couchDBCollectionOptions<unknown, never, FallbackType>(
      config,
    );

    type ExpectedType = ResolveType<unknown, never, FallbackType>;
    // The getKey function should have the resolved type
    expectTypeOf(options.getKey).parameters.toEqualTypeOf<[FallbackType]>();
    expectTypeOf<ExpectedType>().toEqualTypeOf<FallbackType>();
  });

  it(`should correctly resolve type with all three types provided`, () => {
    const options = couchDBCollectionOptions<
      ExplicitType,
      typeof testSchema,
      FallbackType
    >({
      couch: {
        db,
      },
      schema: testSchema,
    });

    type ExpectedType = ResolveType<
      ExplicitType,
      typeof testSchema,
      FallbackType
    >;
    // The getKey function should have the resolved type
    expectTypeOf(options.getKey).parameters.toEqualTypeOf<
      [ExplicitType & CouchDBCollectionDoc]
    >();
    expectTypeOf<ExpectedType>().toEqualTypeOf<ExplicitType>();
  });

  it(`should infer types from Zod schema through couch collection options to live query`, () => {
    // Define a Zod schema for a user with basic field types
    const userSchema = z.object({
      _id: z.string(),
      _rev: z.string().optional(),
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
      active: z.boolean(),
    });

    type UserType = z.infer<typeof userSchema>;

    // Create couch collection options with the schema
    const couchOptions = couchDBCollectionOptions({
      couch: { db },
      schema: userSchema,
    });

    // Create a collection using the couch options
    const usersCollection = createCollection(couchOptions);

    // Create a live query collection that uses the users collection
    const activeUsersQuery = createLiveQueryCollection({
      query: (q) =>
        q
          .from({ user: usersCollection })
          .where(({ user }) => eq(user.active, true))
          .select(({ user }) => ({
            id: user._id,
            name: user.name,
            age: user.age,
            email: user.email,
            isActive: user.active,
          })),
    });

    // Test that the query results have the correct inferred types
    const results = activeUsersQuery.toArray;
    expectTypeOf(results).toEqualTypeOf<
      Array<{
        id: string;
        name: string;
        age: number;
        email: string;
        isActive: boolean;
      }>
    >();

    // Test that the collection itself has the correct type

    expectTypeOf(usersCollection.toArray).toEqualTypeOf<
      Array<UserType & CouchDBCollectionDoc>
    >();

    // Test that we can access schema-inferred fields in the query with WHERE conditions
    const ageFilterQuery = createLiveQueryCollection({
      query: (q) =>
        q
          .from({ user: usersCollection })
          .where(({ user }) => eq(user.active, true) && gt(user.age, 18)) // eslint-disable-line @typescript-eslint/no-unnecessary-condition
          .select(({ user }) => ({
            id: user._id,
            name: user.name,
            age: user.age,
          })),
    });

    const ageFilterResults = ageFilterQuery.toArray;
    expectTypeOf(ageFilterResults).toEqualTypeOf<
      Array<{
        id: string;
        name: string;
        age: number;
      }>
    >();

    // Test that the getKey function has the correct parameter type
    expectTypeOf(couchOptions.getKey).parameters.toEqualTypeOf<
      [UserType & CouchDBCollectionDoc]
    >();
  });

  it(`should demonstrate the difference between couch options and direct createCollection with schema`, () => {
    // Define a Zod schema with basic fields
    const userSchema = z.object({
      _id: z.string(),
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
      active: z.boolean(),
    });

    type UserType = z.infer<typeof userSchema>;

    // Method 1: Using couch collection options (WORKS)
    const couchOptions = couchDBCollectionOptions({
      couch: {
        db,
      },
      schema: userSchema,
    });

    const couchCollection = createCollection(couchOptions);

    // Method 2: Using direct createCollection with schema (FAILS with never types)
    const directCollection = createCollection({
      id: `test-direct`,
      schema: userSchema,
      getKey: (item) => item._id,
      sync: {
        sync: ({ begin, commit, markReady }) => {
          begin();
          commit();
          markReady();
        },
      },
    });

    // Test that couch collection works correctly
    const couchQuery = createLiveQueryCollection({
      query: (q) =>
        q.from({ user: couchCollection }).select(({ user }) => ({
          id: user._id,
          name: user.name,
          age: user.age,
        })),
    });

    const couchResults = couchQuery.toArray;
    expectTypeOf(couchResults).toEqualTypeOf<
      Array<{
        id: string;
        name: string;
        age: number;
      }>
    >();

    // Test that direct collection has the correct type
    expectTypeOf(directCollection.toArray).toEqualTypeOf<Array<UserType>>();

    // The key insight: couch collection options properly resolve schema types
    // while direct createCollection with schema doesn't work in query builder
    expectTypeOf(couchOptions.getKey).parameters.toEqualTypeOf<
      [UserType & CouchDBCollectionDoc]
    >();
  });
});
