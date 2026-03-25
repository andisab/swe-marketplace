# Review Synthesis

Merge all validated findings into a deduplicated, severity-ranked report with a fix plan.

## All Findings (Post Cross-Examination)
{VALIDATED_FINDINGS}

## Disputed Findings
{DISPUTED_FINDINGS}

## Rules
1. **Deduplicate**: If multiple reviewers flagged the same issue, merge into one entry listing all sources.
2. **Severity assignment**:
   - 🔴 **Bug** — Breaks correctness, security, or data integrity. Fix before next session.
   - 🟡 **Nit** — Style, naming, minor improvement. Worth fixing, not urgent.
   - 🟣 **Pre-existing** — Issue not introduced by recent changes but discovered during review.
3. **Rank**: 🔴 first, then 🟡, then 🟣. Within a tier, rank by reviewer agreement count (more reviewers = higher priority).
4. **Fix plan**: Group action items by file path. Each item is a checkbox with line number, description, and severity tag.
5. **Discard disputed findings** UNLESS 2+ reviewers validated them despite the dispute.
6. **Include metadata**: Duration, models used, scope stats, and cross-examination round count.

## Output Format

```markdown
# Adversarial Code Review — {TIMESTAMP}

## Scope
{SCOPE_DESCRIPTION}

## Summary
- 🔴 Bugs: N
- 🟡 Nits: N
- 🟣 Pre-existing: N
- Reviewers: Codex (quality, testing), Gemini (implementation, docs), Claude (simplification)
- Cross-examination rounds: N (converged | max reached)

## Findings

### 🔴 Bug: <title>
**File:** `path:line_range`
**Reported by:** <reviewer(s)>
**Validated by:** N/M cross-examination rounds
**Description:** <what's wrong>
**Evidence:** <code snippet>
**Fix:** <concrete action>

### 🟡 Nit: <title>
...

### 🟣 Pre-existing: <title>
...

## Fix Plan

### path/to/file.ext
1. [ ] Line N: <fix description> (🔴)
2. [ ] Line N: <fix description> (🟡)

### path/to/other.ext
1. [ ] Line N: <fix description> (🔴)
...

## Review Metadata
- Duration: Ns
- Models used: codex, gemini-2.5-pro, claude-sonnet
- Scope files: N
- Cross-examination rounds: N
```
