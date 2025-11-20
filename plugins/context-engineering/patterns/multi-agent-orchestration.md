# Multi-Agent Orchestration Pattern

## Overview

Multi-agent orchestration is a design pattern where multiple specialized agents collaborate to solve complex problems that exceed the scope of a single agent. Each agent handles a specific domain or phase, coordinating through a central orchestrator or workflow.

## When to Use Multi-Agent Systems

### ✅ Use Multi-Agent Orchestration When:

1. **Task spans multiple domains**
   - Example: Full-stack feature (backend + frontend + database + tests)
   - No single agent has expertise across all areas

2. **Parallel execution is beneficial**
   - Example: Code review (security + performance + style in parallel)
   - Independent analysis can run concurrently

3. **Complex workflow with clear phases**
   - Example: Deployment (checks → build → test → deploy → verify)
   - Each phase has distinct requirements

4. **Different model requirements**
   - Example: Planning (opus) + Implementation (sonnet) + Testing (haiku)
   - Cost optimization through model selection

5. **Context window management**
   - Example: Large codebase analysis
   - Agents work on chunks, orchestrator aggregates

### ❌ Don't Use Multi-Agent When:

1. **Single agent suffices**
   - Simple, focused tasks
   - One domain of expertise

2. **Coordination overhead exceeds benefit**
   - Communication between agents costs more than direct execution

3. **No clear decomposition**
   - Task can't be meaningfully split

## Orchestration Patterns

### Pattern 1: Sequential Pipeline

Agents execute in sequence, each consuming previous agent's output.

```
Orchestrator → Agent A → Agent B → Agent C → Results
```

**Example: Feature Development**

```
1. PRD Writer → Product Requirements Document
2. Backend Developer → API implementation (using PRD)
3. Frontend Developer → UI implementation (using API)
4. Test Engineer → Test suite (using backend + frontend)
5. Documentation Writer → User guide (using everything)
```

**Implementation**:

```markdown
# Orchestrator: Feature Development Workflow

## Phase 1: Requirements (PRD Writer Agent)
Task: Create PRD for: $FEATURE_NAME

→ Output: PRD document

## Phase 2: Backend (Backend Developer Agent)
Task: Implement API endpoints according to PRD
Context: @prd.md

→ Output: Backend code + API docs

## Phase 3: Frontend (Frontend Developer Agent)
Task: Build UI components
Context: @prd.md, @api-docs.md

→ Output: Frontend code

## Phase 4: Testing (Test Engineer Agent)
Task: Create test suite
Context: @prd.md, @backend-code, @frontend-code

→ Output: Tests

## Phase 5: Documentation (Documentation Writer Agent)
Task: Write user guide
Context: @prd.md, @api-docs.md, @ui-specs

→ Output: Documentation
```

**Pros**:
- Simple to understand
- Clear dependencies
- Easy to debug

**Cons**:
- No parallelization
- Slower for independent tasks
- Bottleneck if one agent is slow

### Pattern 2: Parallel Fan-Out/Fan-In

Orchestrator distributes work to multiple agents in parallel, then aggregates results.

```
                 ┌→ Agent A →┐
Orchestrator ───→┼→ Agent B →┼→ Aggregator → Results
                 └→ Agent C →┘
```

**Example: Code Review**

```
                    ┌→ Security Reviewer →┐
Code Changes ──────→┼→ Performance Reviewer →┼→ Summary → PR Comment
                    ├→ Style Reviewer →────┤
                    └→ Documentation Reviewer →┘
```

**Implementation**:

```markdown
# Orchestrator: Code Review Pipeline

## Distribute: Launch parallel reviews

Task for Security Reviewer:
- Analyze for vulnerabilities
- Check authentication/authorization
- Validate input sanitization

Task for Performance Reviewer:
- Identify N+1 queries
- Check algorithmic complexity
- Find memory leaks

Task for Style Reviewer:
- Verify naming conventions
- Check code organization
- Validate formatting

Task for Documentation Reviewer:
- Ensure API docs updated
- Check inline comments
- Verify README changes

## Aggregate: Combine all feedback

Security issues: [from Security Reviewer]
Performance concerns: [from Performance Reviewer]
Style violations: [from Style Reviewer]
Documentation gaps: [from Documentation Reviewer]

## Generate: Final review comment
Priority: Critical security issues first
```

**Pros**:
- Fast (parallel execution)
- Independent analysis
- Scalable (add more agents)

**Cons**:
- More complex coordination
- Results may conflict
- Aggregation logic needed

### Pattern 3: Hierarchical Delegation

Top-level orchestrator delegates to sub-orchestrators, which manage specialized agents.

```
Master Orchestrator
    ├→ Backend Orchestrator
    │      ├→ API Developer
    │      └→ Database Expert
    ├→ Frontend Orchestrator
    │      ├→ React Developer
    │      └→ Designer
    └→ DevOps Orchestrator
           ├→ Docker Engineer
           └→ K8s Expert
```

**Example: Microservices Deployment**

```
Deployment Master
    ├→ Service A Orchestrator
    │      ├→ Build Agent
    │      ├→ Test Agent
    │      └→ Deploy Agent
    ├→ Service B Orchestrator
    │      ├→ Build Agent
    │      ├→ Test Agent
    │      └→ Deploy Agent
    └→ Infrastructure Orchestrator
           ├→ Database Migration
           └→ Load Balancer Config
```

**Pros**:
- Handles complex systems
- Clear hierarchy
- Domain separation

**Cons**:
- Most complex pattern
- Deep nesting
- Coordination overhead

### Pattern 4: State Machine / Graph

Agents connected in a graph with conditional transitions based on results.

```
Start → Agent A → (success) → Agent B → End
              \→ (failure) → Agent C → Agent A
```

**Example: Deployment with Rollback**

```
Start
  ↓
Pre-checks → (pass) → Build → (success) → Deploy → (success) → Verify → End
           ↘ (fail)                     ↘ (fail)   ↘ (fail)
             ↓                            ↓          ↓
           Alert ←────────────────────── Rollback ←─┘
```

**Implementation with LangGraph** (conceptual):

```python
from langgraph import StateGraph

workflow = StateGraph()

workflow.add_node("pre_checks", pre_check_agent)
workflow.add_node("build", build_agent)
workflow.add_node("deploy", deploy_agent)
workflow.add_node("verify", verify_agent)
workflow.add_node("rollback", rollback_agent)

workflow.add_edge("pre_checks", "build", condition="success")
workflow.add_edge("pre_checks", "alert", condition="failure")
workflow.add_edge("build", "deploy", condition="success")
workflow.add_edge("build", "alert", condition="failure")
workflow.add_edge("deploy", "verify", condition="success")
workflow.add_edge("deploy", "rollback", condition="failure")
workflow.add_edge("verify", "end", condition="success")
workflow.add_edge("verify", "rollback", condition="failure")
```

**Pros**:
- Handles complex workflows
- Conditional logic
- Error recovery paths

**Cons**:
- Complex to design
- Difficult to debug
- State management overhead

## Coordination Mechanisms

### 1. Explicit Hand-offs (Recommended for Claude Code)

Orchestrator explicitly invokes each agent with Task tool.

```markdown
# Orchestrator Agent

## Step 1: Requirements
Use Task tool to invoke prd-writer agent:
- Input: Feature description
- Output: PRD document

Wait for completion, receive PRD.

## Step 2: Backend Development
Use Task tool to invoke backend-developer agent:
- Input: PRD from Step 1
- Output: API code

Wait for completion, receive code.

## Step 3: Continue...
```

**Benefits**:
- Clear control flow
- Easy to debug
- Predictable execution

### 2. Shared Context

Agents communicate through shared files or memory.

```markdown
# Agent A writes to shared context
Create file: /tmp/workflow-state.json
{
  "phase": "backend-complete",
  "api_endpoint": "/api/users",
  "next_agent": "frontend-developer"
}

# Agent B reads from shared context
Read file: /tmp/workflow-state.json
Use api_endpoint for frontend integration
```

**Benefits**:
- Asynchronous communication
- State persistence
- Multiple readers

**Drawbacks**:
- File management complexity
- Race conditions
- State synchronization

### 3. Message Passing

Orchestrator maintains message queue between agents.

```markdown
# Orchestrator maintains messages

messages = []

# Agent A produces message
messages.append({
  "from": "backend-developer",
  "to": "frontend-developer",
  "content": "API deployed at /api/v1/users",
  "data": api_schema
})

# Agent B consumes message
frontend_tasks = [m for m in messages if m["to"] == "frontend-developer"]
```

**Benefits**:
- Clear communication
- Audit trail
- Debugging support

**Drawbacks**:
- Memory overhead
- Orchestrator complexity

## Real-World Examples

### Example 1: Security Hardening Workflow

**Goal**: Comprehensive security audit and hardening

**Pattern**: Parallel Fan-Out/Fan-In

**Agents**:
1. **SAST Scanner** - Static analysis for vulnerabilities
2. **Dependency Auditor** - Check for vulnerable dependencies
3. **Secret Scanner** - Find exposed credentials
4. **Config Reviewer** - Validate security configurations
5. **Aggregator** - Combine findings and prioritize

**Orchestrator**:

```markdown
# Security Hardening Orchestrator

## Phase 1: Parallel Scans

Launch in parallel:

**SAST Scanner**:
- Run Bandit (Python), ESLint security (JS)
- Check for SQL injection, XSS, CSRF
- Output: sast-report.json

**Dependency Auditor**:
- Run npm audit, pip-audit
- Check CVE databases
- Output: dependency-report.json

**Secret Scanner**:
- Scan for API keys, passwords, tokens
- Check git history
- Output: secrets-report.json

**Config Reviewer**:
- Review .env.example, config files
- Check CORS, CSP, permissions
- Output: config-report.json

## Phase 2: Aggregate Results

Combine all reports:
- Critical: [issues requiring immediate action]
- High: [issues to fix before release]
- Medium: [issues to address soon]
- Low: [issues for backlog]

## Phase 3: Generate Remediation Plan

For each issue:
1. Severity and impact
2. Specific fix guidance
3. Code examples
4. Testing verification

Output: security-hardening-plan.md
```

### Example 2: Full-Stack Feature Development

**Goal**: Implement complete feature from PRD to deployment

**Pattern**: Sequential Pipeline with Parallel Phases

**Agents**:
1. **PRD Writer** - Product requirements
2. **Backend Developer** - API implementation
3. **Frontend Developer** - UI implementation
4. **Test Engineer** - Test suite
5. **DevOps Engineer** - Deployment
6. **Documentation Writer** - User docs

**Orchestrator**:

```markdown
# Feature Development Orchestrator

## Phase 1: Planning
Agent: prd-writer
Input: Feature description from user
Output: PRD (product-requirements.md)

## Phase 2: Development (Parallel)

**Backend Track**:
Agent: backend-developer
Input: @product-requirements.md
Output: API code + tests

**Frontend Track** (waits for API schema):
Agent: frontend-developer
Input: @product-requirements.md, @api-schema.json
Output: UI code + tests

## Phase 3: Integration Testing
Agent: test-engineer
Input: @backend-code, @frontend-code
Output: Integration test suite

Run tests: npm run test:integration

## Phase 4: Deployment
Agent: devops-engineer
Input: Test results
Actions:
- Build Docker containers
- Deploy to staging
- Run smoke tests
- Deploy to production (if approved)

## Phase 5: Documentation
Agent: documentation-writer
Input: @prd, @api-docs, @ui-specs
Output: User guide, API reference, release notes
```

### Example 3: Research Agent System

**Goal**: Research a topic and produce comprehensive report

**Pattern**: Hierarchical Delegation

**Agents**:
1. **Master Researcher** - Orchestrates research
2. **Web Searcher** - Find online resources
3. **Academic Searcher** - Find papers and studies
4. **Code Searcher** - Find implementations
5. **Synthesizer** - Combine findings
6. **Report Writer** - Generate final document

**Orchestrator**:

```markdown
# Research Orchestrator

## Input
Topic: [User-provided research topic]
Depth: [Comprehensive | Overview | Quick Summary]

## Phase 1: Decompose Topic
Break topic into subtopics:
1. [Subtopic 1]
2. [Subtopic 2]
3. [Subtopic 3]

## Phase 2: Parallel Research

For each subtopic, launch parallel researchers:

**Web Searcher**:
- Search general web sources
- Find blog posts, articles, tutorials
- Extract key insights

**Academic Searcher**:
- Search academic databases
- Find papers, studies, research
- Extract methodologies and findings

**Code Searcher**:
- Search GitHub, GitLab
- Find implementations
- Analyze patterns

## Phase 3: Synthesis
Agent: synthesizer
Input: All research findings
Output: Organized, deduplicated insights

## Phase 4: Report Writing
Agent: report-writer
Input: Synthesized insights
Output: Final research report with:
- Executive summary
- Detailed findings
- Code examples
- References
```

## Best Practices

### 1. Keep Orchestrators Simple

**❌ Complex orchestrator**:
```markdown
# Do analysis, then based on results, decide between 15 different paths,
# each with nested conditionals and sub-workflows...
```

**✅ Simple orchestrator**:
```markdown
# Step 1: Analysis Agent
# Step 2: If critical issues, invoke Fix Agent
# Step 3: If tests pass, invoke Deploy Agent
```

### 2. Make Hand-offs Explicit

**❌ Implicit**:
```markdown
# Run all agents and hope they figure out dependencies
```

**✅ Explicit**:
```markdown
# Step 1: Agent A creates @output-a.json
# Step 2: Agent B uses @output-a.json as input
# Step 3: Agent C uses @output-b.json as input
```

### 3. Provide Clear Context to Each Agent

**❌ Minimal context**:
```markdown
Task: Build frontend
```

**✅ Complete context**:
```markdown
Task: Build frontend for user authentication feature
Input Documents:
- @product-requirements.md (what to build)
- @api-schema.json (backend endpoints)
- @design-mockups.pdf (visual design)
Requirements:
- React + TypeScript
- Form validation
- Error handling
- Responsive design
```

### 4. Handle Failures Gracefully

```markdown
# Orchestrator with error handling

## Step 1: Pre-checks
Try: Run pre-check agent
On failure:
  - Log failure reason
  - Alert user
  - STOP workflow

## Step 2: Build
Try: Run build agent
On failure:
  - Save error logs
  - Run diagnostic agent
  - Provide fix suggestions
  - Allow retry

## Step 3: Deploy
Try: Run deploy agent
On failure:
  - ROLLBACK immediately
  - Run rollback agent
  - Verify rollback success
  - Alert on-call
```

### 5. Log and Track Progress

```markdown
# Orchestrator with logging

## Workflow: Feature Development
Started: [timestamp]

[Step 1/5] PRD Creation - IN PROGRESS
Agent: prd-writer
Started: [timestamp]
Status: Analyzing requirements...

[Step 1/5] PRD Creation - COMPLETED
Duration: 45s
Output: product-requirements.md (1250 tokens)

[Step 2/5] Backend Development - IN PROGRESS
Agent: backend-developer
Started: [timestamp]
Status: Generating API endpoints...

...

Workflow completed in 5m 23s
Total tokens used: 45,230
```

### 6. Consider Token Budgets

```markdown
# Orchestrator with token awareness

Total budget: 50,000 tokens (25% of context window)

Agent allocations:
- PRD Writer: 5,000 tokens
- Backend Developer: 15,000 tokens
- Frontend Developer: 15,000 tokens
- Test Engineer: 10,000 tokens
- Documentation: 5,000 tokens

Track usage:
- PRD Writer used: 4,230 tokens (✓ under budget)
- Backend Developer used: 18,500 tokens (⚠️ over by 3,500)
- Adjust remaining allocations...
```

## Anti-Patterns to Avoid

### ❌ Too Many Agents

Don't create an agent for every tiny subtask.

```markdown
# Bad: 20 agents for small tasks
- File Reader Agent
- JSON Parser Agent
- String Formatter Agent
- ... (17 more tiny agents)
```

**Better**: Combine related capabilities into focused agents.

### ❌ Circular Dependencies

Don't create cycles in agent dependencies.

```markdown
# Bad: Agent A needs Agent B, Agent B needs Agent A
Agent A → Agent B → Agent A → ...
```

**Better**: Restructure workflow to eliminate cycles.

### ❌ No Clear Ownership

Don't leave responsibilities ambiguous.

```markdown
# Bad: Who handles database schema?
- Backend Agent: "I implement APIs, not schema"
- Database Agent: "I optimize queries, not schema"
- DevOps Agent: "I deploy, not design"
```

**Better**: Explicitly assign all responsibilities.

### ❌ Ignoring Failures

Don't continue workflow after critical failures.

```markdown
# Bad:
Step 1: Tests fail
Step 2: Deploy anyway ← WRONG!
```

**Better**: Stop and handle failures appropriately.

## Tools for Orchestration

### Within Claude Code

**Task Tool**: Primary mechanism for invoking sub-agents

```python
# Orchestrator agent uses Task tool
result = task(
    agent="backend-developer",
    prompt="Implement user authentication API",
    context="@requirements.md"
)
```

**File-Based Communication**: Agents write/read shared files

```python
# Agent A writes
write_file("api-schema.json", schema)

# Agent B reads
schema = read_file("api-schema.json")
```

### External Frameworks (Reference)

**LangGraph** (Python):
- State machines
- Conditional edges
- Parallel execution

**LangChain Agents** (Python/TypeScript):
- Agent chains
- Tool composition
- Memory systems

**Claude Agent SDK** (TypeScript/Python):
- Multi-agent systems
- Streaming responses
- Tool integration

## Success Criteria

Multi-agent orchestration is successful when:

- **Clear decomposition**: Tasks are meaningfully split
- **Efficient coordination**: Minimal overhead between agents
- **Graceful handling**: Failures don't cascade
- **Understandable flow**: Easy to debug and modify
- **Token efficient**: Total usage less than sequential monolithic approach
- **Faster execution**: Parallel paths complete concurrently
- **High quality output**: Combined result exceeds single-agent capability

## Key Takeaways

1. **Use when beneficial**: Don't over-engineer simple tasks
2. **Choose right pattern**: Sequential, parallel, hierarchical, or state machine
3. **Explicit coordination**: Clear hand-offs and dependencies
4. **Handle failures**: Don't ignore errors
5. **Track progress**: Logging and monitoring
6. **Manage tokens**: Budget allocation across agents
7. **Test thoroughly**: Complex systems need comprehensive testing

Multi-agent orchestration is powerful for complex workflows but adds overhead. Use it when the benefits (parallelization, specialization, modularity) outweigh the coordination costs.
