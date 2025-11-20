# JavaScript Development Guide

## Build & Test Commands

### Using Bun (recommended)
- Install dependencies: `bun install`
- Run scripts: `bun run dev`
- Execute file: `bun run index.js`
- Test: `bun test`

### Using npm (alternative)
- Install dependencies: `npm install`
- Install dev dependencies: `npm install --save-dev`
- Run scripts: `npm run dev`
- Clean install: `npm ci`

### Testing and linting
- Run tests: `bun test` or `npm test`
- Run single test: `bun test tests/user.test.js`
- Format code: `npx @biomejs/biome format --write .`
- Lint: `npx @biomejs/biome check .`
- Fix issues: `npx @biomejs/biome check --apply .`

## Technical Stack

- **JavaScript version**: ES2022+ (use latest stable features)
- **Runtime**: Node.js 20+ or Bun 1.0+
- **Module system**: ES Modules (`.mjs` or `"type": "module"` in package.json)
- **Package management**: Bun for speed, npm for compatibility
- **Linting/Formatting**: Biome (25x faster than ESLint + Prettier)
- **Testing**: Vitest for modern projects, Jest for legacy
- **Build tool**: Vite for applications, esbuild for libraries

## Code Style Guidelines

- **Formatting**: Use Biome with default settings
- **Semicolons**: Omit (Biome default)
- **Quotes**: Single quotes for strings, backticks for templates
- **Line length**: 80 characters for readability
- **Indentation**: 2 spaces (JavaScript convention)
- **Naming**: camelCase for variables/functions, PascalCase for constructors/classes
- **File naming**: kebab-case (e.g., `user-service.js`)
- **Constants**: UPPER_SNAKE_CASE for true constants only

## JavaScript Best Practices

- **Variable declarations**: Use `const` by default, `let` when reassignment needed, never `var`
- **Functions**: Prefer arrow functions for callbacks, named functions for hoisting
- **Async code**: Use async/await over Promise chains for readability
- **Error handling**: Always catch errors in async functions, use try/catch blocks
- **Equality**: Use `===` and `!==` for strict equality checks
- **Type coercion**: Be explicit (use `String()`, `Number()`, `Boolean()`)
- **Object destructuring**: Use for cleaner parameter handling
- **Array methods**: Prefer `.map()`, `.filter()`, `.reduce()` over loops
- **Template literals**: Use for string interpolation and multi-line strings
- **Optional chaining**: Use `?.` for safe property access
- **Nullish coalescing**: Use `??` instead of `||` for null/undefined checks

## Development Patterns & Best Practices

- **Module boundaries**: Each module exports a single concern
- **Pure functions**: Prefer functions without side effects
- **Early returns**: Exit functions early to reduce nesting
- **Guard clauses**: Validate inputs at function start
- **Named exports**: Prefer over default exports for better refactoring
- **Dependency injection**: Pass dependencies as parameters
- **Configuration**: Use environment variables via `process.env`
- **File organization**: Group by feature, not by file type
- **Code splitting**: Keep files under 200 lines
- **Comments**: Explain "why" not "what", use JSDoc for public APIs

## Error Handling Patterns

```javascript
// Good: Specific error handling with context
async function fetchUser(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch user ${userId}: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Error in fetchUser:`, error)
    throw error // Re-throw for caller to handle
  }
}

// Good: Custom error classes
class ValidationError extends Error {
  constructor(field, value) {
    super(`Invalid ${field}: ${value}`)
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}
```

## Performance Guidelines

- **Bundle size**: Use dynamic imports for code splitting
- **Debouncing**: Throttle expensive operations (search, resize)
- **Memoization**: Cache expensive computations
- **Web Workers**: Offload CPU-intensive tasks
- **Memory**: Clean up event listeners and timers
- **Loops**: Use `for...of` for arrays, `for...in` for objects (with hasOwnProperty)

## Security Best Practices

- **Input validation**: Never trust user input, validate all data
- **XSS prevention**: Escape HTML, use textContent over innerHTML
- **Dependencies**: Audit regularly with `npm audit`
- **Secrets**: Never commit secrets, use environment variables
- **HTTPS**: Always use secure protocols for API calls
- **Content Security Policy**: Implement CSP headers
- **Rate limiting**: Implement on all public endpoints

## Testing Standards

- **Test structure**: Use Arrange-Act-Assert pattern
- **Test names**: Use descriptive names that explain the scenario
- **Test isolation**: Each test should be independent
- **Mocking**: Mock external dependencies, not internal modules
- **Coverage**: Aim for 80%+ coverage on business logic
- **Test files**: Name as `*.test.js` or `*.spec.js`
- **Assertions**: One logical assertion per test

```javascript
// Good: Clear test structure
describe('UserService', () => {
  it('should create a user with valid email', async () => {
    // Arrange
    const userData = { email: 'test@example.com', name: 'Test User' }
    
    // Act
    const user = await createUser(userData)
    
    // Assert
    expect(user.email).toBe('test@example.com')
    expect(user.id).toBeDefined()
  })
})
```

## Project Configuration

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

```javascript
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": { "level": "warn" }
      }
    }
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  }
}
```
