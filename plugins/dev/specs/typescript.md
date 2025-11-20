# TypeScript Development Guide

## Build & Test Commands

### Using Bun (recommended)
- Type check: `bunx tsc --noEmit`
- Build: `bun build src/index.ts --outdir=dist`
- Run: `bun run src/index.ts`
- Test: `bun test`

### Using npm/tsc
- Type check: `npx tsc --noEmit`
- Build: `npx tsc`
- Watch mode: `npx tsc --watch`
- Build & run: `npx tsx src/index.ts`

### Testing and type checking
- Type check: `tsc --noEmit`
- Type coverage: `npx type-coverage`
- Test with types: `vitest --typecheck`
- Lint types: `tsc --noEmit && biome check .`

## Technical Stack

- **TypeScript version**: 5.5+ (use latest stable)
- **Target**: ES2022 or later
- **Module**: NodeNext for Node.js, ESNext for browsers
- **Strict mode**: Always enabled with all strict flags
- **Type checking**: Use `tsc` for types, separate tool for transpilation
- **Runtime validation**: Zod for API boundaries
- **Build tools**: esbuild/swc for speed, tsc for type checking only

## TypeScript Configuration

```json
{
  "compilerOptions": {
    // Strictness - ALL must be true
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    
    // Module system
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "es2022",
    "lib": ["es2023"],
    
    // Emit configuration
    "noEmit": true,  // Use build tool for emit
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    
    // Path mapping
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Type System Best Practices

- **Type inference**: Let TypeScript infer when obvious, annotate when not
- **Interfaces vs Types**: Use interfaces for objects, types for unions/intersections
- **Enums**: Avoid numeric enums, use const objects or string literal unions
- **Any**: Never use `any`, use `unknown` for truly unknown types
- **Assertions**: Avoid type assertions, use type guards instead
- **Nullability**: Use strict null checks, explicit `| null` or `| undefined`
- **Generics**: Use meaningful names (not just `T`), add constraints
- **Utility types**: Master built-in utilities (Partial, Required, Pick, Omit)

## Advanced Type Patterns

### Branded Types for Domain Modeling
```typescript
// Create nominal types for type safety
type Brand<T, B> = T & { __brand: B }

type UserId = Brand<string, 'UserId'>
type Email = Brand<string, 'Email'>
type PositiveNumber = Brand<number, 'PositiveNumber'>

// Type guards for validation
function isEmail(value: string): value is Email {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function createEmail(value: string): Email {
  if (!isEmail(value)) {
    throw new Error(`Invalid email: ${value}`)
  }
  return value as Email
}
```

### Discriminated Unions for State
```typescript
// Good: Type-safe state handling
type LoadingState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

function handleState<T>(state: LoadingState<T>) {
  switch (state.status) {
    case 'success':
      return state.data  // TypeScript knows data exists
    case 'error':
      return state.error // TypeScript knows error exists
    // ...
  }
}
```

### Const Assertions and Template Literals
```typescript
// Use const assertions for literal types
const ROLES = ['admin', 'user', 'guest'] as const
type Role = typeof ROLES[number]  // 'admin' | 'user' | 'guest'

// Template literal types
type ApiEndpoint = `/api/${string}`
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type RoutePattern = `${HttpMethod} ${ApiEndpoint}`
```

## Runtime Validation with Zod

```typescript
import { z } from 'zod'

// Define schema once, infer types
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().positive().max(120),
  roles: z.array(z.enum(['admin', 'user', 'guest'])),
  metadata: z.record(z.unknown()).optional()
})

// Type is automatically inferred
type User = z.infer<typeof UserSchema>

// Runtime validation at boundaries
export async function createUser(data: unknown): Promise<User> {
  const validated = UserSchema.parse(data)  // Throws if invalid
  return await userRepository.save(validated)
}
```

## Error Handling in TypeScript

```typescript
// Type-safe error handling
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Result type pattern
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await api.getUser(id)
    return { ok: true, value: user }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}
```

## Module Organization

- **Barrel exports**: Use index.ts for public API only
- **Type exports**: Export types separately from implementations
- **File naming**: Use `.types.ts` suffix for type-only files
- **Import order**: Types first, then implementations
- **Circular dependencies**: Use type-only imports to break cycles

```typescript
// user.types.ts
export interface User {
  id: string
  email: string
}

// user.service.ts
import type { User } from './user.types'  // type-only import

export class UserService {
  async getUser(id: string): Promise<User> {
    // Implementation
  }
}

// index.ts (barrel export)
export type { User } from './user.types'
export { UserService } from './user.service'
```

## Performance Considerations

- **Type checking**: Run in CI, not in build pipeline
- **Build performance**: Use esbuild/swc for transpilation
- **Import cost**: Use type-only imports when possible
- **Declaration files**: Generate `.d.ts` files for libraries
- **Incremental builds**: Enable `incremental` in tsconfig
- **Project references**: Use for large monorepos

## Common Pitfalls to Avoid

- **Don't**: Use `as` for type assertions without validation
- **Don't**: Use `@ts-ignore` or `@ts-expect-error` without explanation
- **Don't**: Define types in global scope
- **Don't**: Use `Function` type (use specific signatures)
- **Don't**: Overuse generics when specific types work
- **Don't**: Mix `null` and `undefined` without reason
- **Do**: Enable all strict flags from the start
- **Do**: Use exhaustive checks in switch statements
- **Do**: Validate external data at runtime
