# Multi-Agent Research Pattern

## Overview

The multi-agent research pattern enables comprehensive investigation of complex topics by coordinating multiple specialized agents working in parallel. This pattern is particularly effective for research requiring diverse perspectives, multiple subtopics, or comprehensive coverage of a subject area.

## Architecture

### Components

1. **Lead Research Coordinator** (Orchestrator)
   - Analyzes research requests
   - Breaks topics into 2-4 distinct subtopics
   - Spawns researcher subagents in parallel
   - Coordinates report synthesis
   - Tools: Task only

2. **Research Specialists** (Workers)
   - Conduct focused research on specific subtopics
   - Use WebSearch exclusively (no training knowledge)
   - Save concise findings to files
   - Tools: WebSearch, Write

3. **Research Report Writer** (Synthesizer)
   - Reads all research notes
   - Creates comprehensive summary reports
   - Applies formatting (Joplin skill when mentioned)
   - Tools: Glob, Read, Write, Skill

### Communication Pattern

```
User Request
     ↓
Lead Coordinator
     ├──→ Researcher 1 (Subtopic A) ──→ research_notes/subtopic_a.md
     ├──→ Researcher 2 (Subtopic B) ──→ research_notes/subtopic_b.md
     ├──→ Researcher 3 (Subtopic C) ──→ research_notes/subtopic_c.md
     └──→ Researcher 4 (Subtopic D) ──→ research_notes/subtopic_d.md
           ↓ (all complete)
     Report Writer ──→ reports/final_report.txt
     ↓
User receives report location
```

## Implementation Details

### Parallel Execution

The lead coordinator spawns all researchers **simultaneously**, not sequentially:

**Correct (Parallel):**
```
- Spawn researcher for battery technology
- Spawn researcher for market trends
- Spawn researcher for manufacturers
- Spawn researcher for infrastructure
(All execute at the same time)
```

**Incorrect (Sequential):**
```
- Spawn researcher for battery technology
- Wait for completion
- Then spawn researcher for market trends
- Wait for completion
(Wastes time, defeats the purpose)
```

### File-Based Coordination

Agents communicate through files rather than direct message passing:

1. **Research Phase**: Each researcher saves findings to `~/Documents/ClaudeResearch/research_notes/{subtopic}.md`
2. **Synthesis Phase**: Report writer reads all files from `research_notes/` directory
3. **Output Phase**: Final report saved to `~/Documents/ClaudeResearch/reports/{topic}_summary_YYYYMMDD.txt`

### Context Isolation

Each subagent operates with its own context window:
- Researchers don't see each other's work until synthesis
- Report writer sees all research notes but not the original request details
- Lead coordinator doesn't perform research itself

## Usage Guidelines

### When to Use This Pattern

✅ **Good Use Cases:**
- Market research requiring multiple angles (competitors, trends, technology, regulations)
- Technical comparisons (features, pricing, performance, ecosystem)
- Academic research (history, current state, future directions, applications)
- Competitive analysis (product features, market position, customer sentiment, financials)

❌ **Poor Use Cases:**
- Simple factual queries answerable in one search
- Questions requiring real-time interaction with user
- Topics with insufficient web information
- Highly specialized topics needing expert knowledge unavailable via web search

### Best Practices

1. **Subtopic Decomposition**
   - Break into 2-4 distinct angles (not more, not less)
   - Ensure subtopics don't overlap significantly
   - Make each subtopic specific and focused
   - Aim for comprehensive coverage of the main topic

2. **Research Quality**
   - Each researcher should run 3-7 WebSearch queries
   - Focus on authoritative, recent sources
   - Include URLs and citations
   - Keep notes concise (3-4 paragraphs max per researcher)

3. **Report Synthesis**
   - Report writer should read ALL research notes
   - Synthesize into coherent narrative
   - Maintain citations from original research
   - Keep final report to 500-800 words unless otherwise specified

## Example: Electric Vehicles Research

### Request
"Research the latest developments in electric vehicles"

### Subtopic Breakdown
1. **Researcher 1**: Battery technology and charging speeds
2. **Researcher 2**: Market trends and adoption rates
3. **Researcher 3**: Major manufacturers and new models
4. **Researcher 4**: Charging infrastructure and grid impact

### Research Notes Output
- `~/Documents/ClaudeResearch/research_notes/ev_battery_technology.md`
- `~/Documents/ClaudeResearch/research_notes/ev_market_trends.md`
- `~/Documents/ClaudeResearch/research_notes/ev_manufacturers.md`
- `~/Documents/ClaudeResearch/research_notes/ev_infrastructure.md`

### Final Report
- `~/Documents/ClaudeResearch/reports/electric_vehicles_summary_20251117.txt`

## Advantages

1. **Parallel Processing**: Multiple research tasks execute simultaneously
2. **Context Management**: Each agent has focused context, avoiding token limits
3. **Specialization**: Each researcher focuses on one aspect deeply
4. **Comprehensive Coverage**: Multiple perspectives ensure thorough investigation
5. **Scalability**: Pattern works for 2-4 subtopics easily

## Limitations

1. **Coordination Overhead**: Requires lead agent to properly decompose topics
2. **File Dependencies**: Researchers must save files correctly for synthesis
3. **No Cross-Pollination**: Researchers don't build on each other's findings during research phase
4. **WebSearch Dependency**: Limited to publicly available web information
5. **Fixed Workflow**: Not suitable for iterative or exploratory research requiring user feedback

## Integration with Joplin

When user mentions "Joplin":
- Report writer activates `joplin-research` skill
- Output format changes to markdown (.md extension)
- Follows specific formatting guidelines (headings, spacing, citations)
- Optimized for Joplin note-taking application

## Monitoring and Debugging

### Success Indicators
- All researchers complete and save files
- Report writer finds all research notes
- Final report synthesizes all findings
- User receives clear completion message with file location

### Common Issues
- **Missing research notes**: Researcher didn't save file or used wrong path
- **Empty report**: Report writer couldn't find research notes
- **Incomplete coverage**: Lead agent didn't break down topic well
- **Poor synthesis**: Research notes were too sparse or lacked citations

### Debugging Tips
- Check `~/Documents/ClaudeResearch/research_notes/` for all expected files
- Verify each researcher actually used WebSearch (check for URLs in notes)
- Confirm report writer read all files (should mention number of sources)
- Review lead agent's subtopic breakdown for clarity and coverage
