---
name: skill-dev
description: >
  Use this skill when creating or refining Claude Code skill definitions. Skills are model-invoked
  capabilities that Claude activates autonomously based on context. Helps design focused skills with
  discovery-optimized descriptions, proper directory structures, and supporting resources. Automatically
  invoked when user requests "create a skill", "make a capability", "add autonomous behavior", or mentions
  skill development. Ensures skills follow Anthropic specifications with clear activation triggers.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(mkdir:*), Bash(tree:*), mcp__Conventions__search_conventions
---

# Skill Dev Skill

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

## Use Case Categories

Anthropic identifies three common skill categories:

| Category | Purpose | Example |
|----------|---------|---------|
| **Document & Asset Creation** | Produce tangible outputs (reports, documents, designs, code) | A `frontend-design` skill that creates production-grade UI components |
| **Workflow Automation** | Orchestrate multi-step processes with validation gates | A `skill-creator` skill that walks users through use case definition, frontmatter, and validation |
| **MCP Enhancement** | Add knowledge and best practices on top of MCP tool access | A `sentry-code-review` skill that uses Sentry's MCP to analyze and fix bugs in PRs |

**The kitchen analogy**: MCP provides the professional kitchen (tools, ingredients, equipment). Skills provide the recipes (step-by-step instructions on how to create something valuable). Together, they enable users to accomplish complex tasks without figuring out every step themselves. See `patterns/skill-mcp-integration.md` for in-depth MCP integration guidance.

### Problem-First vs. Tool-First

When designing a skill, choose your framing:

- **Problem-first**: Start from a user pain point, then orchestrate the right tools to solve it. Users describe outcomes; the skill handles the tools. Example: "I need to set up a project workspace" → skill orchestrates MCP calls in the right sequence.
- **Tool-first**: You have MCP tools connected, and the skill teaches Claude optimal workflows and best practices for using them. Users have access; the skill provides expertise. Example: "I have Notion MCP connected" → skill teaches Claude the best project setup workflows.

Most skills lean one direction. Knowing which framing fits your use case helps you choose the right pattern (see Common Patterns below).

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
├── assets/                     # Optional: Static resources (templates, fonts, icons)
│   └── report-template.md
└── scripts/                    # Optional: Helper scripts
    └── helper.py
```

**Important**: Do NOT include `README.md` inside skill directories. `SKILL.md` serves as both the skill definition and documentation. When distributing via GitHub, use a repo-level README for human users — that is separate from the skill folder contents.

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
- Should match the skill folder name
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
5. **Negative triggers**: Explicitly state what the skill does NOT handle to prevent over-triggering (see "Do NOT use for:" in example below)

**Constraints**: Description must be under 1024 characters. No XML angle brackets (`<` or `>`).

**Debug technique**: Ask Claude: "When would you use the [skill name] skill?" Claude will quote the description back — adjust based on what's missing or misaligned.

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

### Optional Frontmatter Fields

Beyond `name`, `description`, and `allowed-tools`, skills support these optional fields:

```yaml
# Optional fields
license: MIT                                    # For open-source skills
compatibility: claude-code, claude-ai, api      # 1-500 chars, environment requirements
# Note: Skills work identically across Claude.ai, Claude Code, and API.
# Create once, use everywhere — provided the environment supports any
# dependencies the skill requires.
metadata:
  author: Your Name
  version: 1.0.0
  mcp-server: server-name                       # If skill enhances an MCP server
  category: workflow                            # document | workflow | mcp-enhancement
  tags: [deployment, automation]
  documentation: https://example.com/docs
  support: support@example.com
```

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

## Success Criteria & Metrics

Define success criteria before building. These are aspirational targets — rough benchmarks rather than precise thresholds.

**Quantitative**:
- Skill triggers on 90%+ of relevant queries (test with 10-20 queries that should activate the skill)
- Completes workflow in expected number of tool calls (compare the same task with and without the skill)
- 0 failed API/MCP calls per workflow run (monitor server logs during test runs)

**Qualitative**:
- Users don't need to prompt Claude about next steps
- Workflows complete without user correction
- Consistent results across sessions (run the same request 3-5 times and compare)

### Iteration Approach

Before building a skill from scratch:
1. Work through the target task manually with Claude until it succeeds
2. Note the exact workflow, prompts, and tool usage that worked
3. Extract the winning approach into a SKILL.md

This produces higher-quality skills than designing from theory alone. It leverages Claude's in-context learning and provides faster signal than broad testing. Once you have a working foundation, expand to multiple test cases for coverage.

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

Five canonical patterns for skill design, based on Anthropic's official guidance:

### Pattern 1: Sequential Workflow Orchestration
Orchestrates multi-step processes in a specific order with validation at each stage.

**Use when**: Users need multi-step processes executed in a defined sequence with dependencies between steps.

```yaml
---
name: customer-onboarding
description: >
  End-to-end customer onboarding workflow. Handles account creation,
  payment setup, and subscription management. Use when user says
  "onboard new customer", "set up subscription", or "create account".
  Do NOT use for account deletion or billing disputes.
---

# Customer Onboarding

## Step 1: Create Account
Call MCP tool: `create_customer`
Parameters: name, email, company

## Step 2: Setup Payment
Call MCP tool: `setup_payment_method`
Wait for: payment method verification

## Step 3: Create Subscription
Call MCP tool: `create_subscription`
Parameters: plan_id, customer_id (from Step 1)

## Step 4: Send Welcome Email
Call MCP tool: `send_email`
Template: welcome_email_template
```

**Key techniques**: Explicit step ordering, dependencies between steps, validation at each stage, rollback instructions for failures.

### Pattern 2: Multi-MCP Coordination
Orchestrates workflows that span multiple MCP services.

**Use when**: A workflow requires coordinating data and actions across different services.

```yaml
---
name: design-handoff
description: >
  Design-to-development handoff workflow. Exports assets from Figma,
  stores in Drive, creates Linear tasks, notifies Slack. Use when
  user mentions "design handoff", "dev handoff", or "hand off designs".
  Do NOT use for design review or feedback workflows.
metadata:
  category: workflow
  mcp-server: figma, google-drive, linear, slack
---

# Design-to-Dev Handoff

## Phase 1: Design Export (Figma MCP)
1. Export design assets from Figma
2. Generate design specifications
3. Create asset manifest

## Phase 2: Asset Storage (Drive MCP)
1. Create project folder in Drive
2. Upload all assets
3. Generate shareable links

## Phase 3: Task Creation (Linear MCP)
1. Create development tasks
2. Attach asset links to tasks
3. Assign to engineering team

## Phase 4: Notification (Slack MCP)
1. Post handoff summary to #engineering
2. Include asset links and task references
```

**Key techniques**: Clear phase separation, data passing between MCPs, validation before moving to next phase, centralized error handling.

### Pattern 3: Iterative Refinement
Output quality improves through validation loops.

**Use when**: The task benefits from draft-check-refine cycles rather than single-pass execution.

```yaml
---
name: report-generation
description: >
  Generate and refine data reports with quality validation. Use when user
  requests "create report", "generate analysis", or "build summary".
  Do NOT use for ad-hoc data queries or simple lookups.
---

# Iterative Report Creation

## Initial Draft
1. Fetch data via MCP
2. Generate first draft report
3. Save to temporary file

## Quality Check
1. Run validation script: `scripts/check_report.py`
2. Identify issues: missing sections, inconsistent formatting, data errors

## Refinement Loop
1. Address each identified issue
2. Regenerate affected sections
3. Re-validate
4. Repeat until quality threshold met

## Finalization
1. Apply final formatting
2. Generate summary
3. Save final version
```

**Key techniques**: Explicit quality criteria, iterative improvement, validation scripts, clear exit conditions for the refinement loop.

### Pattern 4: Context-Aware Tool Selection
Same outcome, different tools depending on context.

**Use when**: The skill needs to dynamically choose between tools or approaches based on input characteristics.

```yaml
---
name: smart-file-storage
description: >
  Intelligently store files in the appropriate service based on type
  and size. Use when user wants to "save", "store", or "upload" files.
  Do NOT use for file retrieval or search.
---

# Smart File Storage

## Decision Tree
1. Check file type and size
2. Determine best storage location:
   - Large files (>10MB): Use cloud storage MCP
   - Collaborative docs: Use Notion/Docs MCP
   - Code files: Use GitHub MCP
   - Temporary files: Use local storage

## Execute Storage
Based on decision:
- Call appropriate MCP tool
- Apply service-specific metadata
- Generate access link

## Provide Context to User
Explain why that storage was chosen
```

**Key techniques**: Clear decision criteria, fallback options, transparency about choices made.

### Pattern 5: Domain-Specific Intelligence
Skill adds specialized knowledge beyond raw tool access.

**Use when**: The skill's value comes from embedding domain expertise, compliance rules, or institutional knowledge that users would otherwise need to supply manually.

```yaml
---
name: payment-compliance
description: >
  Payment processing with regulatory compliance checks. Handles
  transaction validation, sanctions screening, and audit trails.
  Use when user mentions "process payment", "transaction", or
  "payment compliance". Do NOT use for refunds or chargebacks.
metadata:
  category: mcp-enhancement
  mcp-server: payment-gateway
---

# Payment Processing with Compliance

## Before Processing (Compliance Check)
1. Fetch transaction details via MCP
2. Apply compliance rules:
   - Check sanctions lists
   - Verify jurisdiction allowances
   - Assess risk level
3. Document compliance decision

## Processing
IF compliance passed:
  - Call payment processing MCP tool
  - Apply appropriate fraud checks
  - Process transaction
ELSE:
  - Flag for review
  - Create compliance case

## Audit Trail
- Log all compliance checks
- Record processing decisions
- Generate audit report
```

**Key techniques**: Domain expertise embedded in logic, compliance-before-action flow, comprehensive documentation, clear governance.

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

## Troubleshooting

**Bundled scripts**: For critical validations, bundle a script in `scripts/` rather than relying on language instructions. Scripts are deterministic; language interpretation isn't.

**Model laziness**: If Claude skips steps, add explicit phrasing: "Take your time. Quality is more important than speed. Do not skip validation steps." Note: this is more effective in user prompts than in SKILL.md.

**SKILL.md size**: Keep SKILL.md under 5,000 words. Move detailed documentation to `references/`. If the skill seems slow or responses degrade, check whether too much content is inline.

**Simultaneous skills**: Claude supports 20-50 skills simultaneously. Beyond that, activation accuracy may decrease. Consider skill "packs" for related capabilities and selective enablement.

## Security Notes

- **No XML angle brackets** (`<` or `>`) in SKILL.md content — they can conflict with Claude's internal processing and create security vulnerabilities
- **Reserved names**: Skills with "claude" or "anthropic" in the name are reserved by Anthropic
- **Safe YAML parsing**: Frontmatter uses safe YAML parsing — no code execution in frontmatter fields

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
