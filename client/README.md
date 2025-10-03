# Client - React Frontend

React 19 application with type-safe [tRPC](https://trpc.io/docs/client/react) integration.

## Development

```bash
pnpm dev      # Vite dev server at http://localhost:5173
pnpm build    # Production build
pnpm preview  # Preview production build
```

## tRPC Client Patterns

### Queries with Infinite Scroll

```tsx
const { data, fetchNextPage } = trpc.experience.list.useInfiniteQuery({
  limit: 10,
});
```

### Mutations with Cache Invalidation

```tsx
const utils = trpc.useUtils();
const mutation = trpc.experience.create.useMutation({
  onSuccess: () => utils.experience.list.invalidate(),
});
```

### Route Loaders (TanStack Router)

```tsx
// routes/experiences/$id.tsx
export const Route = createFileRoute('/experiences/$id')({
  loader: ({ params, context }) =>
    context.trpc.experience.getById.query({ id: params.id }),
});
```

## Tech Stack

- React 19 + Vite + TanStack Router/Query
- tRPC Client + Radix UI + Tailwind CSS
- React Hook Form + Zod validation

## Resources

- [tRPC React Client](https://trpc.io/docs/client/react)
- [TanStack Query](https://tanstack.com/query/latest)
- [TanStack Router](https://tanstack.com/router/latest)
