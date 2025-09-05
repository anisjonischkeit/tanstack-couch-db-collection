# CouchDB Colletion for Tanstack DB

## Install

```bash
pnpm install tanstack-couch-db-collection@github:anisjonischkeit/tanstack-couch-db-collection
```

## Usage

```ts
import { createCollection } from "@tanstack/react-db";
import { couchDBCollectionOptions } from "tanstack-couch-db-collection";
import PouchDB from "pouchdb";

// This could be a local or a remote database. If you want a local and
// remote DB, you can let couch DB handle syncing between databases
// https://pouchdb.com/api.html#sync
const db = new PouchDB("local-db");

const schema = z.object({
  _id: z.string(),
  name: z.string(),
});

export const usersCollection = createCollection(
  couchDBCollectionOptions<typeof schema._output>({
    db: db,
    schema: schema,
  }),
);
```

Then use it like any other Tanstack DB collection

```ts
// In React, subscribe to updates in your DB
const { data, isLoading } = useLiveQuery(usersCollection);

// Insert, update or delete data to your DB with optimistic updates
usersCollection.insert({
  _id: "3008fc4e-0813-4432-a989-a51cd4e881fb",
  name: "Something",
});

usersCollection.update({
  _id: "3008fc4e-0813-4432-a989-a51cd4e881fb",
  name: "Something",
});

usersCollection.delete({
  _id: "3008fc4e-0813-4432-a989-a51cd4e881fb",
});

// Join with other collections
const userPosts = createLiveQueryCollection((q) =>
  q
    .from({ user: usersCollection })
    // Posts can be another couchDB collection, or any other kind of collection
    .join({ post: postsCollection }, ({ couch, post }) =>
      eq(user._id, post.userId),
    ),
);
```

See the [Tanstack DB Docs](https://tanstack.com/db/latest/docs/overview) for more
