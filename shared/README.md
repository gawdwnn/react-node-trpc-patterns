# Shared - Common Code

Shared code used by both client and server for consistency across the full stack.

## Zod Validation Schemas

End-to-end type safety through shared validation.

## Pattern: Schema-First Development

**Define once, use everywhere:**

```ts
// shared/schema/experience/index.ts
import { z } from "zod";

export const experienceValidationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  scheduledAt: z.string().datetime("Invalid date"),
});

export type ExperienceData = z.infer<typeof experienceValidationSchema>;
```

**Server usage:**

```ts
import { experienceValidationSchema } from '@react-node-trpc-patterns/shared';

export const experienceRouter = router({
  create: protectedProcedure
    .input(experienceValidationSchema)  // Validates input
    .mutation(({ input }) => /* ... */),
});
```

**Client usage:**

```ts
import { experienceValidationSchema } from "@react-node-trpc-patterns/shared";

const form = useForm({
  resolver: zodResolver(experienceValidationSchema), // Form validation
});
```

## Available Schemas

- `auth/` - Login, register, user credentials, password/email changes
- `comment/` - Comment validation
- `experience/` - Experience/post creation and filtering

## Resources

- [Zod Documentation](https://zod.dev)
- [tRPC Input Validation](https://trpc.io/docs/server/validators)
