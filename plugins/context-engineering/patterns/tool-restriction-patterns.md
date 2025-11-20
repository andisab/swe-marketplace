# Tool Restriction Patterns

## Overview

Tool restriction is a security and focus pattern where agents, skills, and commands are granted only the minimal set of tools necessary to accomplish their tasks. This follows the **Principle of Least Privilege** - each component should have access to only what it needs, nothing more.

## Why Restrict Tools?

### Security Benefits

1. **Prevent accidental damage**: Can't delete files if no Write tool
2. **Limit attack surface**: Compromised component can't escalate privileges
3. **Protect sensitive data**: Read-only agents can't leak via Write
4. **Audit compliance**: Clear trail of what each component can do

### Focus Benefits

1. **Clearer intent**: Tool list documents component's purpose
2. **Easier debugging**: Fewer tools = simpler troubleshooting
3. **Better performance**: Claude considers fewer options
4. **Prevents scope creep**: Forces component to stay focused

### Cost Benefits

1. **Faster decisions**: Fewer tools to evaluate
2. **Lower token usage**: Smaller context for tool descriptions
3. **Reduced errors**: Less chance of using wrong tool

## Tool Access Levels

### Level 1: Read-Only (Safest)

**Tools**: `Read`, `Grep`, `Glob`

**Use for**:
- Analysis agents
- Code reviewers
- Documentation analyzers
- Research agents
- Audit tools

**Example**:

```yaml
---
name: security-auditor
tools: Read, Grep, Glob
---

You are a security auditor who analyzes code for vulnerabilities.
You can read and search files, but cannot modify anything.
```

**What it CAN do**:
- Read any file
- Search codebase
- Analyze patterns
- Generate reports

**What it CANNOT do**:
- Modify files
- Execute commands
- Create/delete files
- Access network

### Level 2: Read + Limited Bash (Controlled)

**Tools**: `Read`, `Grep`, `Glob`, `Bash(git:*)`, `Bash(npm:*)`

**Use for**:
- Status checkers
- Test runners (no modification)
- Git query tools
- Package inspectors

**Example**:

```yaml
---
name: git-status-checker
tools: Read, Grep, Glob, Bash(git:*), Bash(npm:*)
---

You can read files and run git/npm status commands.
You cannot modify code or execute arbitrary commands.
```

**What it CAN do**:
- All Read-Only capabilities
- Run `git status`, `git log`, `git diff`
- Run `npm run test` (if configured)
- Check git history

**What it CANNOT do**:
- Modify files
- Run arbitrary bash commands
- Install packages
- Change git state

### Level 3: Read + Write (Moderate Risk)

**Tools**: `Read`, `Write`, `Edit`, `MultiEdit`, `Grep`, `Glob`

**Use for**:
- Code generators
- Refactoring agents
- Documentation writers
- Template expanders

**Example**:

```yaml
---
name: code-generator
tools: Read, Write, Edit, MultiEdit, Grep, Glob
---

You can read and modify files, but cannot execute bash commands.
```

**What it CAN do**:
- All Read-Only capabilities
- Create new files
- Edit existing files
- Delete files (via Write)
- Multi-file edits

**What it CANNOT do**:
- Execute commands
- Access network
- Run tests
- Interact with git

### Level 4: Read + Write + Limited Bash (Higher Risk)

**Tools**: `Read`, `Write`, `Edit`, `Bash(git:*)`, `Bash(npm:*)`

**Use for**:
- Feature developers
- Deployment helpers
- Build tools
- Integration agents

**Example**:

```yaml
---
name: feature-developer
tools: Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(pytest:*)
---

You can modify code and run specific development commands.
```

**What it CAN do**:
- All Read + Write capabilities
- Run git commands
- Run npm scripts
- Run tests
- Check build status

**What it CANNOT do**:
- Run arbitrary bash commands
- Access network directly
- Modify system files
- Install system packages

### Level 5: Full Access (Highest Risk)

**Tools**: Omit `tools` field (inherits all tools)

**Use for**:
- General-purpose agents
- DevOps automation
- System administrators
- Emergency troubleshooting

**Example**:

```yaml
---
name: devops-admin
# No tools field = inherits all tools
---

You have full access to all tools. Use responsibly.
```

**What it CAN do**:
- Everything from previous levels
- Run any bash command
- Access network (WebFetch, WebSearch)
- Use MCP tools
- Execute arbitrary code

**What it CANNOT do**:
- Nothing (full access)

**⚠️ Use sparingly**: Only for truly general-purpose or admin agents.

## Tool Restriction Patterns

### Pattern 1: Graduated Access

Start restrictive, add tools only when needed.

**Example: Code Review Evolution**

```yaml
# Version 1: Read-only reviewer
---
name: code-reviewer
tools: Read, Grep, Glob
---

# Version 2: Add git for context
---
name: code-reviewer
tools: Read, Grep, Glob, Bash(git:*)
---

# Version 3: Add editing for auto-fixes
---
name: code-reviewer
tools: Read, Grep, Glob, Bash(git:*), Edit
---
```

**Process**:
1. Start with minimal tools
2. User encounters limitation
3. Add specific tool needed
4. Document why tool was added

### Pattern 2: Purpose-Based Restriction

Match tools to component's stated purpose.

**Example: Different Analyzers**

```yaml
# Security analyzer: Read-only
---
name: security-analyzer
description: Analyze code for security vulnerabilities (read-only audit)
tools: Read, Grep, Glob
---

# Performance optimizer: Needs to modify
---
name: performance-optimizer
description: Refactor code for better performance
tools: Read, Edit, MultiEdit, Grep
---

# Deployment manager: Needs bash access
---
name: deployment-manager
description: Deploy applications to staging/production
tools: Read, Bash(git:*), Bash(npm:*), Bash(ssh:*)
---
```

**Principle**: Tool list should match the "description" promise.

### Pattern 3: Environment-Specific Restrictions

Different tool access for different environments.

**Example: Deployment Agent**

```yaml
# Development environment
---
name: dev-deployer
description: Deploy to development environment
tools: Read, Write, Bash(git:*), Bash(npm:*), Bash(docker:*)
---

# Production environment
---
name: prod-deployer
description: Deploy to production (controlled access)
tools: Read, Bash(git pull:*), Bash(npm run build:*), Bash(ssh deploy@prod:*)
# Note: No Write access in production!
# Note: Only specific git/npm commands allowed!
---
```

**Principle**: More restrictions in sensitive environments.

### Pattern 4: Data Sensitivity-Based

Restrict based on data access level.

```yaml
# Public data handler: Normal access
---
name: public-api-generator
tools: Read, Write, Edit, Bash(npm:*)
---

# PII handler: Read-only + logging
---
name: pii-data-auditor
description: Audit PII handling (read-only, logs all access)
tools: Read, Grep
# Note: All file reads are logged for compliance
---

# Secrets handler: Minimal access
---
name: secrets-rotator
description: Rotate API keys and secrets
tools: Read, Edit
# Note: No Bash to prevent secret exfiltration
# Note: No WebFetch to prevent sending secrets externally
---
```

**Principle**: More sensitive data = more restrictions.

### Pattern 5: Skill-Specific Restrictions

Skills inherit tools from conversation unless restricted.

```yaml
# Skill for automated PDF processing
---
name: pdf-processor
description: Extract text and tables from PDFs
allowed-tools: Read, Write, Bash(pdftotext:*)
---

# Skill for web scraping
---
name: web-scraper
description: Scrape and parse web pages
allowed-tools: WebFetch, Write
# Note: No Bash to prevent code execution from untrusted sites
---

# Skill for code analysis
---
name: code-analyzer
description: Analyze code quality and patterns
allowed-tools: Read, Grep, Glob
# Note: Read-only to prevent accidental modifications
---
```

**Principle**: Skills should be even more restricted than agents (they activate autonomously).

## Bash Command Restrictions

### Wildcard Patterns

Restrict to specific command families:

```yaml
tools: Bash(git:*)          # All git commands
tools: Bash(npm:*)          # All npm commands
tools: Bash(docker:*)       # All docker commands
tools: Bash(pytest:*)       # All pytest commands
```

### Specific Commands

Allow only exact commands:

```yaml
tools: Bash(git status:*), Bash(git log:*), Bash(git diff:*)
# Allows: git status, git log, git diff
# Blocks: git push, git commit, git reset
```

### Read-Only Operations

Prevent destructive operations:

```yaml
tools: Bash(git log:*), Bash(git show:*), Bash(git diff:*)
# Read-only git operations
# No git commit, git push, git reset, etc.
```

### Safe Subsets

Allow safe subset of commands:

```yaml
# Package inspection (no installation)
tools: Bash(npm list:*), Bash(npm outdated:*), Bash(npm audit:*)

# File inspection (no modification)
tools: Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(find:*)

# System inspection (no changes)
tools: Bash(ps:*), Bash(top:*), Bash(df:*), Bash(du:*)
```

## Real-World Examples

### Example 1: Security Audit Agent

**Purpose**: Analyze code for security vulnerabilities

**Risk**: High (analyzes sensitive code)

**Tool Set**: Read-only

```yaml
---
name: security-auditor
description: >
  Comprehensive security audit of codebase. Analyzes for OWASP Top 10
  vulnerabilities, authentication issues, and data exposure risks.
tools: Read, Grep, Glob
model: opus
---

You are a security auditor with READ-ONLY access.

## What You Can Do
- Read all files in the codebase
- Search for security patterns
- Analyze authentication/authorization
- Generate security reports

## What You CANNOT Do
- Modify any files
- Execute any commands
- Access the network
- Run tests

## Why These Restrictions
- Prevents accidental code changes during audit
- Ensures audit is non-invasive
- Creates clear audit trail (read-only = can't tamper)
- Compliance requirement (auditors can't modify what they audit)

## If You Need to Suggest Fixes
- Provide code examples in your report
- Don't attempt to make changes
- User can apply fixes separately
```

**Security Rationale**:
- Auditor can't accidentally (or maliciously) modify code under audit
- Read-only access creates clean audit trail
- Prevents conflicts if code changes during audit

### Example 2: Code Formatter Agent

**Purpose**: Auto-format code according to style guide

**Risk**: Medium (modifies code but in predictable ways)

**Tool Set**: Read + Edit only (no bash)

```yaml
---
name: code-formatter
description: >
  Automatically format code according to project style guide.
  Applies consistent naming, indentation, and organization.
tools: Read, Edit, MultiEdit, Grep
model: sonnet
---

You format code but don't execute it.

## What You Can Do
- Read code files
- Edit files to apply formatting
- Search for files needing formatting
- Make multiple edits efficiently

## What You CANNOT Do
- Run formatters like Prettier or Black (no Bash access)
- Run tests to verify formatting (no Bash access)
- Access git to check changes (no Bash access)

## Why These Restrictions
- Prevents running arbitrary code
- Forces you to format manually (more control)
- Can't accidentally run tests or commit changes

## If You Need External Formatters
- Suggest user configure PostToolUse hook:
  \`\`\`json
  {
    "event": "PostToolUse",
    "matchers": {"tool": "Edit"},
    "action": {"command": "prettier --write $file_path"}
  }
  \`\`\`
```

**Security Rationale**:
- Can modify code (needed for formatting) but can't execute it
- No bash = can't run potentially malicious code
- Predictable behavior (formatting only, no tests/builds/commits)

### Example 3: Deployment Manager

**Purpose**: Deploy applications to staging and production

**Risk**: Very High (deploys code, runs in production)

**Tool Set**: Limited bash + Read only

```yaml
---
name: deployment-manager
description: >
  Manages application deployments to staging and production environments.
  Runs builds, tests, and deployment scripts with approval gates.
tools: Read, Bash(git:*), Bash(npm:*), Bash(ssh deploy@*:*)
model: opus
---

You deploy applications with CONTROLLED bash access.

## What You Can Do
- Read deployment configurations
- Run git commands (checkout, pull, status)
- Run npm scripts (build, test)
- SSH to deploy user on staging/production

## What You CANNOT Do
- Edit code directly (no Write/Edit tools)
- Run arbitrary bash commands
- SSH as root or other users
- Access network directly (no WebFetch)

## Why These Restrictions
- No Write = can't modify code during deployment
- Limited bash = only deployment-related commands
- SSH user restriction = can't escalate privileges
- Prevents unauthorized access

## Security Gates
Before production deploy, you MUST:
1. Verify tests pass: `npm run test`
2. Check git status: `git status`
3. Confirm branch: `git rev-parse --abbrev-ref HEAD`
4. Request user approval
5. Only then: `ssh deploy@prod "cd /app && git pull && pm2 restart"`

## If Deployment Fails
1. Log failure reason
2. ROLLBACK immediately
3. Alert on-call team
4. Do NOT retry without approval
```

**Security Rationale**:
- Can't modify code (prevents deploying malicious changes)
- Restricted bash commands (prevents privilege escalation)
- SSH user limitation (can't become root)
- Approval gates (human-in-the-loop for production)

### Example 4: Research Agent

**Purpose**: Research topics and gather information

**Risk**: Low (read-only, external data)

**Tool Set**: Read + WebFetch only

```yaml
---
name: research-agent
description: >
  Research topics by searching web, reading documentation, and
  synthesizing information into comprehensive reports.
tools: Read, WebFetch, WebSearch
model: opus
---

You research topics using web access but can't modify local files.

## What You Can Do
- Search the web for information
- Fetch web pages and documentation
- Read local files for context
- Synthesize findings into reports

## What You CANNOT Do
- Write files locally (no Write tool)
- Execute commands (no Bash)
- Modify code (no Edit)

## Why These Restrictions
- Prevents saving potentially malicious content from web
- Can't execute code found online
- Forces you to present findings to user for review

## How to Share Research
Since you can't write files, you must:
1. Present findings in conversation
2. User can save with explicit Write command
3. This ensures user reviews before saving
```

**Security Rationale**:
- Can access web (needed for research) but can't save locally
- Prevents automatic saving of malicious content
- Human-in-the-loop before persisting external data

## Common Mistakes

### ❌ Mistake 1: "Everything Inherits All Tools"

```yaml
# Bad: Security auditor with full access
---
name: security-auditor
# No tools restriction = inherits everything
---
```

**Problem**: Auditor can modify code it's auditing

**Fix**: Explicit read-only restriction

```yaml
---
name: security-auditor
tools: Read, Grep, Glob
---
```

### ❌ Mistake 2: "Overly Broad Bash Access"

```yaml
# Bad: Code reviewer can run anything
---
name: code-reviewer
tools: Read, Bash
# Bash with no restriction = any command
---
```

**Problem**: Reviewer can execute arbitrary code

**Fix**: Restrict to specific commands

```yaml
---
name: code-reviewer
tools: Read, Bash(git:*), Bash(npm run test:*)
---
```

### ❌ Mistake 3: "Skill Inherits Conversation Tools"

```yaml
# Bad: PDF processor inherits all tools from main conversation
---
name: pdf-processor
description: Process PDF files
# No allowed-tools = inherits everything
---
```

**Problem**: If main conversation has Bash, skill can execute commands

**Fix**: Explicit tool restriction

```yaml
---
name: pdf-processor
description: Process PDF files
allowed-tools: Read, Write
---
```

### ❌ Mistake 4: "Write Access for Read-Only Task"

```yaml
# Bad: Documentation reader can modify docs
---
name: doc-reader
description: Read and summarize documentation
tools: Read, Write, Edit
# Why does a reader need Write/Edit?
---
```

**Problem**: Unnecessary write access

**Fix**: Remove unnecessary tools

```yaml
---
name: doc-reader
description: Read and summarize documentation
tools: Read
---
```

## Tool Restriction Decision Matrix

| Component Purpose | Recommended Tools | Rationale |
|-------------------|------------------|-----------|
| Code analysis | Read, Grep, Glob | No modification needed |
| Security audit | Read, Grep, Glob | Audit must be non-invasive |
| Code generation | Read, Write, Edit, MultiEdit | Creates new files |
| Code refactoring | Read, Edit, MultiEdit, Grep | Modifies existing code |
| Test runner | Read, Bash(npm:*), Bash(pytest:*) | Runs tests only |
| Deployment | Read, Bash(git:*), Bash(npm:*), Bash(ssh:*) | Deploys with specific commands |
| Research | Read, WebFetch, WebSearch | External data gathering |
| Documentation | Read, Write, Grep, Glob | Creates documentation |
| Git helper | Read, Bash(git:*) | Git operations only |
| General assistant | (no restriction) | Needs flexibility |

## Testing Tool Restrictions

### Test 1: Attempt Blocked Action

```yaml
# Agent with Read-only
tools: Read, Grep
```

**Test**: Try to edit a file

**Expected**: Error - "Edit tool not available"

**Verification**: Tool restriction working

### Test 2: Verify Allowed Actions

```yaml
# Agent with specific bash access
tools: Read, Bash(git:*)
```

**Test**: Run `git status`

**Expected**: Success

**Test**: Run `npm install`

**Expected**: Error - "Bash(npm:*) not allowed"

### Test 3: Check Skill Inheritance

```yaml
# Skill with tool restriction
allowed-tools: Read
```

**Test**: Activate skill, try to write file

**Expected**: Error - "Write tool not allowed for this skill"

**Verification**: Skill restrictions override conversation

## Best Practices Summary

1. **Start restrictive**: Begin with minimal tools, add as needed
2. **Match purpose**: Tools should align with component description
3. **Explicit is better**: Even if inheriting, explicitly list tools for clarity
4. **Document why**: Explain tool restrictions in component description
5. **Test restrictions**: Verify tools work as expected
6. **Review regularly**: Ensure restrictions still appropriate as component evolves
7. **Principle of least privilege**: Grant only necessary access
8. **Security-sensitive components**: Extra restrictions for auditing, secrets, production
9. **Skills more restrictive**: Skills activate autonomously, need tighter control
10. **Use wildcards wisely**: `Bash(git:*)` better than `Bash` alone

## Key Takeaways

- **Security through restriction**: Limit access to limit risk
- **Clarity through restriction**: Tool list documents purpose
- **Performance through restriction**: Fewer tools = faster decisions
- **Three levels**: Read-only < Read+Write < Read+Write+Bash
- **Bash patterns**: Use wildcards to restrict command families
- **Skills need more restriction**: They activate autonomously
- **Test thoroughly**: Verify restrictions work as expected
- **Document decisions**: Explain why certain tools granted/denied

Tool restriction is not about being stingy - it's about being **intentional**. Every tool should have a clear purpose. If you can't justify why a component needs a tool, it probably doesn't need it.
