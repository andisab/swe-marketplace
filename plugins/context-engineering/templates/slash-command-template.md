---
description: [Brief description of what this command does - shown in /help]
argument-hint: [<required-arg>] [[optional-arg]] [--flag]
allowed-tools: Tool1, Tool2, Bash(command:*)
model: sonnet                           # Optional - sonnet (default), opus, haiku
disable-model-invocation: false         # Optional - set true to prevent Claude from invoking
---

[Main prompt content starts here]

[Use $ARGUMENTS to capture all arguments]
[Use $1, $2, $3 for positional arguments]
[Use ${1:-default} for default values]
[Use @file to include file contents]
[Use !command for bash execution (requires allowed-tools)]

---

# Command Template Examples

## Example 1: Simple Prompt Command

File: `.claude/commands/review.md`

```markdown
---
description: Review code for best practices and improvements
---

Please review the following code for:
- Best practices adherence
- Potential bugs or issues
- Performance optimizations
- Code clarity and maintainability

Provide specific, actionable feedback.
```

Usage: `/review`

## Example 2: Command with Arguments

File: `.claude/commands/compare-files.md`

```markdown
---
description: Compare two files and explain differences
argument-hint: <file1> <file2>
allowed-tools: Read
---

Compare these two files and highlight key differences:

**File 1: $1**
@$1

**File 2: $2**
@$2

Provide:
1. Structural differences
2. Logic changes
3. Potential issues introduced
4. Recommendations
```

Usage: `/compare-files old.py new.py`

## Example 3: Command with Default Values

File: `.claude/commands/run-tests.md`

```markdown
---
description: Run test suite with specified environment
argument-hint: [environment] [coverage-flag]
allowed-tools: Bash(npm:*), Bash(pytest:*)
---

Running tests in ${1:-development} environment ${2:+with coverage}

!npm run test${2:+:coverage} -- --env=${1:-development}

Analyzing results...
```

Usage:
- `/run-tests` → development environment, no coverage
- `/run-tests production` → production environment
- `/run-tests development --coverage` → development with coverage

## Example 4: Git Workflow Command

File: `.claude/commands/git-sync.md`

```markdown
---
description: Sync feature branch with main and push
argument-hint: [branch-name]
allowed-tools: Bash(git:*)
---

Syncing ${1:-current} branch with main...

!git fetch origin
!git checkout ${1:-$(git rev-parse --abbrev-ref HEAD)}
!git pull origin ${1:-$(git rev-parse --abbrev-ref HEAD)}
!git merge origin/main
!git push origin ${1:-$(git rev-parse --abbrev-ref HEAD)}

Branch synchronized with main.
```

Usage:
- `/git-sync` → sync current branch
- `/git-sync feature-auth` → sync specific branch

## Example 5: File Processing Command

File: `.claude/commands/analyze-api.md`

```markdown
---
description: Analyze API endpoint for security and performance
argument-hint: <endpoint-file>
allowed-tools: Read, Grep, Glob
---

Analyzing API endpoint: $1

@$1

Security analysis:
1. Authentication and authorization checks
2. Input validation
3. Rate limiting implementation
4. Error handling and information disclosure
5. SQL injection or XSS vulnerabilities

Performance analysis:
1. Database query optimization
2. N+1 query problems
3. Caching opportunities
4. Response size and pagination

Provide specific recommendations for improvements.
```

Usage: `/analyze-api src/api/users.py`

## Example 6: Multi-File Command

File: `.claude/commands/review-pr.md`

```markdown
---
description: Review pull request changes
allowed-tools: Bash(git:*), Read, Grep
---

Pull request review for current changes:

!git diff origin/main..HEAD --name-only

Files changed:
!git diff origin/main..HEAD --stat

Detailed analysis:
!git diff origin/main..HEAD

Review focus:
1. Breaking changes
2. Test coverage
3. Documentation updates
4. Security implications
5. Performance impact

Generate comprehensive PR review with specific feedback on each changed file.
```

Usage: `/review-pr`

## Example 7: Code Generation Command

File: `.claude/commands/new-component.md`

```markdown
---
description: Generate new React component with TypeScript
argument-hint: <ComponentName>
allowed-tools: Write
---

Creating React component: $1

Generate the following files:

1. **Component file**: src/components/$1.tsx
\`\`\`tsx
import React from 'react';

interface ${1}Props {
  // TODO: Define props
}

export const $1: React.FC<${1}Props> = (props) => {
  return (
    <div className="${1}">
      {/* Component content */}
    </div>
  );
};
\`\`\`

2. **Test file**: src/components/$1.test.tsx
\`\`\`tsx
import { render, screen } from '@testing-library/react';
import { $1 } from './$1';

describe('$1', () => {
  it('renders correctly', () => {
    render(<$1 />);
    // Add assertions
  });
});
\`\`\`

3. **Styles file**: src/components/$1.module.css
\`\`\`css
.$1 {
  /* Component styles */
}
\`\`\`
```

Usage: `/new-component UserProfile`

## Example 8: Documentation Command

File: `.claude/commands/doc-function.md`

```markdown
---
description: Generate JSDoc documentation for functions
argument-hint: <file-path>
allowed-tools: Read, Edit
model: opus
---

Generate comprehensive JSDoc for all functions in: $1

@$1

For each function, create:
\`\`\`javascript
/**
 * [Brief description of what the function does]
 *
 * @param {type} paramName - Description of parameter
 * @param {type} [optionalParam] - Description (optional)
 * @returns {type} Description of return value
 * @throws {ErrorType} When error occurs
 * @example
 * // Example usage
 * functionName(arg1, arg2);
 * // => expected output
 */
\`\`\`

Add these JSDoc comments directly above each function in the file.
```

Usage: `/doc-function src/utils/helpers.js`

## Example 9: Deployment Command

File: `.claude/commands/deploy.md`

```markdown
---
description: Deploy application to specified environment
argument-hint: <environment> [--dry-run]
allowed-tools: Bash(npm:*), Bash(git:*), Bash(ssh:*)
model: opus
---

Deploying to: $1 ${2:+(dry run)}

Pre-deployment checks:
!npm run test
!npm run lint
!npm run build

Git status:
!git status

${2:+DRY RUN - No actual deployment}
${2:-Deploying to $1...}

${2:-!npm run deploy:$1}

${2:+Would deploy to: $1}
${2:-Deployment to $1 complete!}

Verify at: https://$1.example.com
```

Usage:
- `/deploy staging --dry-run` → test deployment process
- `/deploy production` → actual deployment

## Example 10: Complex Workflow Command

File: `.claude/commands/feature-complete.md`

```markdown
---
description: Complete feature workflow - test, commit, PR
argument-hint: <feature-name>
allowed-tools: Bash(git:*), Bash(npm:*), Bash(gh:*)
---

Completing feature: $1

Step 1: Run tests
!npm run test

Step 2: Check code quality
!npm run lint
!npm run typecheck

Step 3: Stage changes
!git add .

Step 4: Commit
!git commit -m "feat: $1

🤖 Generated with Claude Code
"

Step 5: Push branch
!git push origin feature/$1

Step 6: Create pull request
!gh pr create --title "Feature: $1" --body "## Changes

- Implemented $1

## Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed

## Checklist
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Breaking changes noted

🤖 Generated with Claude Code"

Feature workflow complete!
Pull request created for: $1
```

Usage: `/feature-complete user-authentication`

---

## Argument Patterns

### No Arguments
```markdown
Please review this codebase for best practices.
```

### Single Argument (All)
```markdown
Analyze: $ARGUMENTS
```

### Positional Arguments
```markdown
Compare $1 with $2 and output in $3 format.
```

### Default Values
```markdown
Run in ${1:-development} mode with ${2:-normal} verbosity.
```

### Optional Arguments
```markdown
Process file: $1 ${2:+with option: $2}
```

### File Reference
```markdown
Review this file:
@$1
```

### Bash Execution
```markdown
!command arg1 arg2
```

## Tool Permissions

Specify only the tools/commands this command needs:

```yaml
# Read-only
allowed-tools: Read, Grep, Glob

# File modification
allowed-tools: Read, Write, Edit

# Specific bash commands
allowed-tools: Bash(git:*), Bash(npm:*)

# Multiple tools
allowed-tools: Read, Write, Bash(git:*), Bash(npm:*), WebSearch
```

## Best Practices

1. **Clear descriptions**: Users see this in `/help`
2. **Argument hints**: Show expected arguments
3. **Tool restrictions**: Only grant necessary permissions
4. **Default values**: Make commands work with minimal input
5. **Error handling**: Account for missing arguments
6. **Documentation**: Include usage examples in comments
