# React Node tRPC Patterns

Full-stack monorepo demonstrating **end-to-end type safety** with React, Node.js, and [tRPC](https://trpc.io).

## Core tRPC Patterns

- **Type-safe API calls:** Client-to-server type inference without code generation
- **Shared validation:** Zod schemas used across client and server
- **Infinite scrolling:** Cursor-based pagination with `useInfiniteQuery`
- **Optimistic updates:** Immediate UI updates with automatic rollback on errors
- **Cache management:** Granular cache invalidation and updates
- **Authentication middleware:** JWT with automatic token refresh
- **Protected procedures:** Reusable middleware for authorization
- **Output validation:** Runtime response validation with Zod
- **File uploads:** Image upload handling with base64 encoding
- **Error handling:** Custom error formatting with Zod error details
- **Complex filtering:** Dynamic query building with multiple search parameters
- **Relational queries:** Eager loading with Drizzle ORM

## Quick Start

```bash
# Install dependencies
pnpm install

# Terminal 1: Run server
cd server && pnpm dev

# Terminal 2: Run client
cd client && pnpm dev
```

## Example: Type-Safe tRPC Flow

**Shared Schema** (`shared/schema/experience.ts`):

```ts
export const createExperienceSchema = z.object({
  title: z.string(),
  content: z.string(),
});
```

**Server Router** (`server/features/experience/router.ts`):

```ts
export const experienceRouter = router({
  create: protectedProcedure
    .input(createExperienceSchema)
    .mutation(({ ctx, input }) => createExperience(ctx.user.id, input)),
});
```

**Client Usage** (`client/src/features/experiences/CreateForm.tsx`):

```tsx
const mutation = trpc.experience.create.useMutation();
// input is fully typed from createExperienceSchema
mutation.mutate({ title: "...", content: "..." });
```

## Example: Optimistic Updates

**Client** - Instant UI updates with automatic rollback on error:

```tsx
const attendMutation = trpc.experiences.attend.useMutation({
  // Update UI immediately before server response
  onMutate: async ({ id }) => {
    await utils.experiences.byId.cancel({ id });
    const previousData = utils.experiences.byId.getData({ id });

    // Optimistically update cache
    utils.experiences.byId.setData({ id }, (old) => ({
      ...old,
      isAttending: true,
      attendeesCount: old.attendeesCount + 1,
    }));

    return { previousData };
  },
  // Rollback on error
  onError: (error, { id }, context) => {
    utils.experiences.byId.setData({ id }, context?.previousData);
  },
});
```

## Example: Cache Invalidation

**Client** - Invalidate related caches after mutations:

```tsx
const deleteMutation = trpc.experiences.delete.useMutation({
  onSuccess: async (id) => {
    // Invalidate multiple related queries
    await Promise.all([
      utils.experiences.feed.invalidate(),
      utils.experiences.byUserId.invalidate({ id: userId }),
      utils.experiences.search.invalidate({ q, tags }),
      utils.experiences.favorites.invalidate(),
    ]);
  },
});
```

## Features Implemented

- **Authentication** - Registration, login, JWT with refresh tokens (*protected procedures, auth middleware*)
- **User Profiles** - Avatar uploads, bio, follow/unfollow (*file uploads, optimistic updates*)
- **Experiences** - CRUD with images, location, scheduling, attendance, kick attendees (*infinite scrolling, file uploads, output validation, optimistic updates*)
- **Comments** - CRUD with likes (*optimistic updates, cache invalidation*)
- **Favorites** - Favorite/unfavorite with dedicated feed (*optimistic updates, infinite scrolling*)
- **Tags** - Tag creation and filtering (*relational queries, complex filtering*)
- **Notifications** - Real-time notification feed (*protected procedures*)
- **Search** - Full-text with tag and date filtering (*complex filtering, infinite scrolling*)
- **Error Handling** - Global boundaries, 404 pages, retry logic (*custom error formatting*)

## Monorepo Structure

- **`client/`** - React frontend ([README](./client/README.md))
  - React 19 + TanStack Router + TanStack Query
- **`server/`** - tRPC backend ([README](./server/README.md))
  - Express + tRPC + Drizzle ORM + SQLite
- **`shared/`** - Zod schemas ([README](./shared/README.md))

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [tRPC Quickstart](https://trpc.io/docs/quickstart)
- [tRPC React Usage](https://trpc.io/docs/client/react)
