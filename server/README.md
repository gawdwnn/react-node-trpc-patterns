# Server - tRPC Backend

Express server with [tRPC](https://trpc.io/docs/server/introduction), JWT authentication, and Drizzle ORM.

## Development

```bash
pnpm dev  # Hot reload at http://localhost:3000
```

## tRPC Server Patterns

### Router Definition

```ts
import { protectedProcedure, router } from '../../trpc';

export const experienceRouter = router({
  list: publicProcedure.input(listSchema).query(({ input }) =>
    getExperiences(input)
  ),

  create: protectedProcedure.input(createSchema).mutation(({ ctx, input }) =>
    createExperience(ctx.user.id, input)  // ctx.user from JWT
  ),
});
```

### Authentication Context

- Access token in `Authorization: Bearer <token>` header
- Refresh token in httpOnly cookie
- Auto-refresh on expiration via context middleware
- `protectedProcedure` ensures `ctx.user` exists

## Database

```bash
pnpm drizzle:generate   # Create migrations
pnpm drizzle:migrate    # Apply migrations
pnpm drizzle:seed       # Add fake data
pnpm drizzle:regenerate # Reset DB
```

## Features

Each feature (`auth`, `comment`, `experience`, `notification`, `tag`, `user`) contains:

- `router.ts` - tRPC endpoints
- `models.ts` - Database operations (Drizzle)
- `schema.ts` - Table definitions

## Resources

- [tRPC Server Usage](https://trpc.io/docs/server/introduction)
- [tRPC Context](https://trpc.io/docs/server/context)
- [tRPC Procedures](https://trpc.io/docs/server/procedures)
