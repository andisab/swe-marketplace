---
name: skill-creation
description: >
  Use this skill when creating or refining Claude Code skill definitions. Skills are model-invoked
  capabilities that Claude activates autonomously based on context. Helps design focused skills with
  discovery-optimized descriptions, proper directory structures, and supporting resources. Automatically
  invoked when user requests "create a skill", "make a capability", "add autonomous behavior", or mentions
  skill development. Ensures skills follow Anthropic specifications with clear activation triggers.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(mkdir:*), Bash(tree:*), mcp__Conventions__search_conventions
---

# Skill Creation Skill

This skill helps create production-ready Claude Code skills following Anthropic's official specifications and best practices.

## Skills vs Agents: Key Differences

| Aspect | Skills | Sub-agents |
|--------|--------|------------|
| **Invocation** | Model-invoked (automatic) | User-invoked (explicit) or Task tool |
| **Scope** | Single capability | Multiple capabilities |
| **File** | Directory with SKILL.md | Single .md file |
| **Supporting files** | Can include templates, scripts | System prompt only |
| **Discovery** | Description matching | Description + explicit invocation |
| **Use case** | Reusable patterns, tools, workflows | Specialized AI assistants |

**When to use Skills**: Create autonomous capabilities that Claude should invoke automatically when context matches (e.g., PDF processing, form filling, specific workflows)

**When to use Agents**: Create specialized AI assistants for complex domains requiring multi-step reasoning (e.g., database expert, security auditor)

## Skill Structure

```
skill-name/
├── SKILL.md                    # Required: Skill definition and content
├── examples/                   # Optional: Example usage
│   ├── basic-usage.md
│   └── advanced-patterns.md
├── templates/                  # Optional: Code templates
│   └── template-file.py
├── references/                 # Optional: Reference materials
│   └── api-docs.md
└── scripts/                    # Optional: Helper scripts
    └── helper.py
```

## SKILL.md Format

```yaml
---
name: skill-name
description: >
  Detailed description of what this skill does, when Claude should use it,
  and specific trigger terms. This field is CRITICAL for skill discovery.

  Include:
  - What the skill accomplishes
  - When to activate (specific scenarios)
  - Key trigger terms users might mention
  - Concrete examples of usage

allowed-tools: Tool1, Tool2    # Optional: Tool restrictions
---

# Skill Content

Main skill content starts here. This is what Claude sees when the skill is activated.

Include:
- Clear instructions
- Examples
- Best practices
- Common patterns
- Error handling

Reference supporting files with relative paths:
- See `examples/basic-usage.md` for getting started
- Use templates from `templates/` directory
- Consult `references/api-docs.md` for API details
```

## Required Fields

### name
Unique identifier for the skill.

**Constraints**:
- Lowercase alphanumeric with hyphens only
- Maximum 64 characters
- Descriptive of the capability

```yaml
name: pdf-form-filling        # Good
name: PDF Form Filling        # Bad - no spaces/capitals
name: helper                  # Bad - too generic
name: skill-that-does-pdf-form-filling-and-extraction  # Bad - too long
```

### description
The MOST IMPORTANT field. Claude uses this to decide when to activate the skill.

**Critical elements**:
1. **Primary capability**: What does this skill do? (1-2 sentences)
2. **Activation triggers**: When should Claude use this? (be specific)
3. **Key terms**: Words/phrases users might mention
4. **Scope boundaries**: What this skill does NOT handle

**Good description example**:
```yaml
description: >
  Extract text and tables from PDF documents, fill PDF forms programmatically,
  and merge multiple PDFs. Use when user mentions PDF files, form filling,
  document parsing, or PDF manipulation.

  Activate for:
  - "Extract data from this PDF"
  - "Fill out this PDF form"
  - "Parse tables from PDF"
  - "Combine these PDFs"

  Do NOT use for:
  - Creating PDFs from scratch (use document generation skill)
  - Image extraction (use image processing skill)
```

**Bad description example**:
```yaml
description: Helps with documents  # Too vague, no trigger terms
```

### allowed-tools (optional)
Restrict which tools the skill can use when activated.

```yaml
# Read-only skill
allowed-tools: Read, Grep, Glob

# File manipulation skill
allowed-tools: Read, Write, Edit

# Full access (can run commands)
allowed-tools: Read, Write, Bash, Grep
```

**When to restrict tools**:
- Security-sensitive operations
- Skills that should only read/analyze
- Prevent accidental modifications

**When to omit** (inherit all tools):
- Skills need flexible tool access
- General-purpose capabilities
- Orchestration skills

## Skill Content Best Practices

### 1. Start with Overview
```markdown
# Skill Name

## Overview
Brief description of what this skill provides and when to use it.

## Capabilities
- List specific capabilities
- Be concrete and actionable
- Include limitations
```

### 2. Provide Clear Instructions
```markdown
## Usage

When this skill is activated, follow these steps:

1. **Step 1**: Clear action with example
   ```python
   # Code example
   ```

2. **Step 2**: Next action
   - Detail A
   - Detail B

3. **Step 3**: Final action
```

### 3. Include Examples
```markdown
## Examples

### Basic Usage
User request: "Extract text from this PDF"

Response approach:
1. Use Read tool to access PDF
2. Parse with PDF library
3. Return extracted text

### Advanced Usage
User request: "Fill out this tax form PDF with data from CSV"

Response approach:
1. Load CSV data
2. Map fields to PDF form
3. Fill and save
```

### 4. Reference Supporting Files
```markdown
## Templates

Use the templates in `templates/` directory:
- `templates/pdf-parser.py` - Basic PDF parsing
- `templates/form-filler.py` - Form field population

## Examples

See `examples/` for complete workflows:
- `examples/basic-extraction.md` - Simple text extraction
- `examples/form-automation.md` - Automated form filling
```

### 5. Error Handling
```markdown
## Error Handling

Common issues and solutions:

**PDF is password protected**:
- Ask user for password
- Use PyPDF2 decrypt method

**Form fields not found**:
- List available fields
- Ask user to map fields manually
```

## File Organization

### Personal Skills (Cross-project)
```
~/.claude/skills/
├── pdf-processing/
│   ├── SKILL.md
│   ├── examples/
│   └── templates/
└── data-analysis/
    ├── SKILL.md
    └── scripts/
```

### Project Skills (Shared with team)
```
.claude/skills/
├── api-testing/
│   ├── SKILL.md
│   ├── templates/
│   │   ├── test-template.py
│   │   └── mock-data.json
│   └── examples/
└── deployment-checks/
    └── SKILL.md
```

### Plugin Skills (Bundled distribution)
```
plugin-name/
└── skills/
    ├── capability-one/
    │   └── SKILL.md
    └── capability-two/
        ├── SKILL.md
        └── helpers/
```

## Supporting Files

### examples/
Concrete usage examples that users can reference.

```markdown
# examples/basic-pdf-extraction.md

## Extracting Text from PDF

User: "Get the text from report.pdf"

Assistant approach:
1. Read the PDF file
2. Use PyPDF2 to extract text
3. Return formatted text

Code:
\`\`\`python
import PyPDF2
# ... extraction code
\`\`\`

Output:
- Extracted text
- Page numbers
- Formatting preserved
```

### templates/
Reusable code scaffolding.

```python
# templates/pdf-parser.py
"""
Template for PDF text extraction
Usage: Adapt for specific PDF parsing needs
"""

import PyPDF2
from typing import List, Dict

def extract_text(pdf_path: str) -> List[str]:
    """Extract text from all pages."""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        return [page.extract_text() for page in reader.pages]

def extract_tables(pdf_path: str) -> List[Dict]:
    """Extract tables from PDF."""
    # Implementation here
    pass
```

### references/
External documentation, API references, best practices.

```markdown
# references/pdf-libraries.md

## Python PDF Libraries

### PyPDF2
- Basic PDF manipulation
- Good for simple text extraction
- Free and lightweight

### pdfplumber
- Advanced table extraction
- Better text positioning
- Recommended for complex layouts

### reportlab
- PDF generation from scratch
- Not for reading existing PDFs
```

### scripts/
Helper utilities that support the skill.

```python
# scripts/pdf-validator.py
"""Validate PDF files before processing."""

def is_valid_pdf(file_path: str) -> bool:
    """Check if file is a valid PDF."""
    # Implementation
    pass

def get_pdf_info(file_path: str) -> dict:
    """Extract PDF metadata."""
    # Implementation
    pass
```

## Discovery Optimization

### Include Specific Trigger Terms
```yaml
description: >
  Process Excel and CSV files, perform data transformations, generate reports.

  Trigger terms: Excel, CSV, spreadsheet, data import, pivot table, VLOOKUP,
  data cleaning, pandas, dataframe, export to Excel
```

### Define Clear Boundaries
```yaml
description: >
  Handle authentication with JWT tokens, OAuth 2.0, and session management.
  Use for login, logout, token refresh, and authorization checks.

  Do NOT use for:
  - Password hashing (use security-utils skill)
  - User registration (use user-management skill)
  - Email verification (use notification skill)
```

### Provide Context Examples
```yaml
description: >
  Database migration management with zero-downtime deployments.

  Activate when user mentions:
  - "Create a migration"
  - "Roll back database changes"
  - "Add a column without downtime"
  - "Database schema updates"

  Example: User says "I need to add a new column to the users table"
  → Activate this skill to create safe migration
```

## Testing Your Skill

After creating a skill:

1. **Test activation**: Use natural language that should trigger the skill
   ```
   User: "Extract the tables from this PDF report"
   Expected: Claude activates pdf-processing skill
   ```

2. **Verify autonomy**: Ensure Claude invokes WITHOUT explicit mention
   - Good: "Parse this PDF" → activates automatically
   - Bad: "Use pdf-processing skill" → requires explicit request

3. **Check boundaries**: Confirm skill doesn't activate for out-of-scope requests
   ```
   User: "Create a PDF from scratch"
   Expected: Skill does NOT activate (out of scope)
   ```

4. **Review supporting files**: Ensure referenced files exist and are accessible

## Progressive Loading

Skills support progressive disclosure - Claude loads content as needed:

1. **Initial load**: SKILL.md frontmatter and main content
2. **On-demand**: Supporting files loaded when referenced
3. **Context management**: Minimize token usage by loading only what's needed

Structure your skill to enable this:
```markdown
# Main Skill Content (loaded immediately)

Brief instructions and common patterns.

## Detailed Examples
See `examples/advanced-usage.md` for detailed examples (loaded on demand).

## API Reference
Consult `references/api-docs.md` for complete API documentation (loaded on demand).
```

## Common Patterns

### Workflow Skill
Orchestrates multi-step processes.

```yaml
---
name: deployment-workflow
description: >
  Orchestrate application deployment with pre-deployment checks, rollout,
  and post-deployment verification. Use when user requests "deploy",
  "release", "push to production", or deployment-related tasks.
---

# Deployment Workflow

## Steps
1. Run pre-deployment checks (tests, linting, security scans)
2. Build application artifacts
3. Deploy to staging
4. Run smoke tests
5. Deploy to production with rollback plan
6. Verify deployment health
```

### Tool Integration Skill
Wraps external tools or APIs.

```yaml
---
name: api-testing
description: >
  Test REST APIs with automated request/response validation. Use when user
  mentions API testing, endpoint verification, or HTTP request debugging.
allowed-tools: Bash, Read, Write
---

# API Testing Skill

Uses `curl` and `jq` to test API endpoints.

## Usage
Provide:
- Endpoint URL
- Expected status code
- Response schema validation

## Templates
See `templates/api-test-template.sh` for test script template.
```

### Analysis Skill
Analyzes and reports on code/data.

```yaml
---
name: code-complexity-analysis
description: >
  Analyze code complexity metrics, cyclomatic complexity, and maintainability.
  Use for code review, refactoring planning, or technical debt assessment.
allowed-tools: Read, Grep, Glob, Bash(radon:*)
---

# Code Complexity Analysis

Generates complexity reports using radon and custom metrics.

## Metrics
- Cyclomatic complexity
- Maintainability index
- Lines of code
- Cognitive complexity
```

## Common Mistakes to Avoid

❌ **Vague description**
```yaml
description: Helps with files
```

✅ **Specific description with triggers**
```yaml
description: >
  Extract text, tables, and metadata from PDF files. Use when user
  mentions PDF parsing, form filling, or document extraction.
```

❌ **Skill too broad**
```yaml
name: backend-development
description: Handles all backend tasks
```

✅ **Focused skill**
```yaml
name: database-migration
description: Create and manage database migrations with zero downtime
```

❌ **Missing trigger terms**
```yaml
description: Processes spreadsheets
```

✅ **Explicit trigger terms**
```yaml
description: >
  Process Excel and CSV files. Activate for: Excel, CSV, spreadsheet,
  XLSX, pandas, dataframe, pivot table
```

❌ **No supporting files structure**
```
skill-name.md          # Just a file, not a directory
```

✅ **Proper directory structure**
```
skill-name/
├── SKILL.md
├── examples/
└── templates/
```

## Skill vs Command vs Agent Decision Matrix

| Need | Use |
|------|-----|
| Autonomous capability (model-invoked) | **Skill** |
| User-invoked reusable prompt | **Command** (slash command) |
| Specialized AI assistant | **Agent** (sub-agent) |
| Multi-step workflow automation | **Skill** |
| Quick text expansion | **Command** |
| Complex reasoning in specific domain | **Agent** |

## Resources

Reference the examples directory for:
- Complete skill definitions across different domains
- Supporting file organization patterns
- Discovery-optimized description templates
- Real-world activation scenarios

---

**Next Steps**: After creating a skill, test activation by using natural language that should trigger it. Refine the description based on actual discovery patterns. Add supporting files progressively as users request more capabilities.
