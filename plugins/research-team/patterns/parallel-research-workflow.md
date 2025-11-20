# Parallel Research Workflow

## Workflow Overview

The parallel research workflow orchestrates multiple research agents working simultaneously to investigate different aspects of a topic, then synthesizes their findings into a comprehensive report.

## Workflow Phases

### Phase 1: Request Analysis

**Responsible Agent**: Lead Research Coordinator

**Activities**:
1. Parse user's research request
2. Identify the core topic and scope
3. Determine 2-4 distinct subtopics or angles
4. Plan comprehensive coverage strategy

**Example**:
- **User Request**: "Research quantum computing"
- **Analysis**: Complex topic requiring multiple perspectives
- **Subtopics**:
  - Hardware and qubit technology
  - Algorithms and applications
  - Industry players and investments
  - Challenges and timeline to quantum advantage

**Duration**: Immediate (< 5 seconds)

### Phase 2: Parallel Research Execution

**Responsible Agents**: 2-4 Research Specialists (spawned in parallel)

**Activities** (per researcher):
1. Receive specific subtopic assignment from coordinator
2. Execute 3-7 WebSearch queries on the subtopic
3. Identify 3-5 most authoritative sources
4. Extract key findings from search results
5. Save concise summary (3-4 paragraphs) to `~/Documents/ClaudeResearch/research_notes/{subtopic}.md`
6. Report completion

**Example** (Researcher 1: Hardware/Qubits):
- Search queries:
  - "quantum computing qubit technology 2025"
  - "superconducting qubits vs trapped ion"
  - "quantum error correction latest advances"
  - "quantum computing hardware companies"
- Top sources: IBM Research, Nature Physics, Google Quantum AI
- Output: `~/Documents/ClaudeResearch/research_notes/quantum_hardware_qubits.md`

**Duration**: 2-5 minutes per researcher (all running simultaneously)

### Phase 3: Research Synthesis

**Responsible Agent**: Research Report Writer

**Activities**:
1. Use Glob to find all files in `~/Documents/ClaudeResearch/research_notes/`
2. Read each research note file
3. Check if "Joplin" was mentioned in original request
4. If Joplin mentioned: Load joplin-research skill, output markdown
5. If plain text: Use standard report format
6. Synthesize all findings into coherent narrative
7. Maintain all citations and sources from research notes
8. Save report to `~/Documents/ClaudeResearch/reports/{topic}_summary_YYYYMMDD.txt` (or .md)

**Example**:
- Input: 4 research notes from `research_notes/`
- Processing: Combine findings, organize by theme
- Output: `~/Documents/ClaudeResearch/reports/quantum_computing_summary_20251117.txt`

**Duration**: 1-2 minutes

### Phase 4: Completion Notification

**Responsible Agent**: Lead Research Coordinator

**Activities**:
1. Confirm report-writer has completed
2. Notify user of completion
3. Provide exact file path to final report

**Example**:
```
Research complete. Report saved to ~/Documents/ClaudeResearch/reports/quantum_computing_summary_20251117.txt
```

**Duration**: Immediate

## File Structure and Organization

### Directory Layout

```
~/Documents/ClaudeResearch/
├── research_notes/           # Intermediate research findings
│   ├── quantum_hardware_qubits.md
│   ├── quantum_algorithms_apps.md
│   ├── quantum_industry_investments.md
│   └── quantum_challenges_timeline.md
└── reports/                  # Final synthesized reports
    └── quantum_computing_summary_20251117.txt
```

### File Naming Conventions

**Research Notes**:
- Format: `{descriptive_subtopic_name}.md`
- Example: `ev_battery_technology.md`
- Location: `~/Documents/ClaudeResearch/research_notes/`

**Final Reports**:
- Format: `{main_topic}_summary_YYYYMMDD.txt` (or `.md` for Joplin)
- Example: `quantum_computing_summary_20251117.txt`
- Location: `~/Documents/ClaudeResearch/reports/`

## Data Flow

```
User Request
     ↓
[Lead Coordinator analyzes and decomposes]
     ↓
┌────────────────────────────────────────┐
│  Parallel Research Phase               │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ Researcher 1 │  │ Researcher 2 │  │
│  │ WebSearch    │  │ WebSearch    │  │
│  │ (3-7 queries)│  │ (3-7 queries)│  │
│  └──────┬───────┘  └──────┬───────┘  │
│         │                  │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  │
│  │ Researcher 3 │  │ Researcher 4 │  │
│  │ WebSearch    │  │ WebSearch    │  │
│  │ (3-7 queries)│  │ (3-7 queries)│  │
│  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────┘
          │                  │
          ▼                  ▼
     note1.md           note2.md
          │                  │
          ▼                  ▼
     note3.md           note4.md
          │                  │
          └────────┬─────────┘
                   ▼
          [Report Writer reads all]
                   ↓
          [Synthesizes findings]
                   ↓
          final_report.txt
                   ↓
          User notification
```

## Timing and Performance

### Expected Durations

| Phase | Duration | Bottleneck |
|-------|----------|------------|
| Analysis | < 5s | Lead agent processing |
| Research (parallel) | 2-5 min | WebSearch API calls |
| Synthesis | 1-2 min | File I/O and LLM processing |
| **Total** | **3-7 min** | WebSearch availability |

### Optimization Strategies

1. **Parallel vs Sequential**:
   - Parallel (4 researchers): 3-7 minutes total
   - Sequential (4 researchers): 12-28 minutes total
   - **Speedup: 4x**

2. **Focused Subtopics**:
   - Specific subtopics reduce redundant searches
   - Each researcher stays within their domain
   - Minimizes overlap in search queries

3. **Concise Notes**:
   - 3-4 paragraphs per researcher
   - Reduces synthesis time
   - Maintains focus on key findings

## Quality Assurance

### Research Quality Checks

**Researcher Level**:
- ✅ Used WebSearch 3-7 times minimum
- ✅ Included URLs from search results
- ✅ Focused on authoritative sources
- ✅ Saved notes to correct location
- ✅ Kept summary concise (3-4 paragraphs)

**Report Writer Level**:
- ✅ Found all research notes
- ✅ Read all files completely
- ✅ Maintained citations from sources
- ✅ Organized findings coherently
- ✅ Applied formatting skill if requested
- ✅ Saved to correct output location

**Coordinator Level**:
- ✅ Decomposed topic into 2-4 subtopics
- ✅ Made subtopics distinct and non-overlapping
- ✅ Spawned researchers in parallel
- ✅ Waited for all researchers before synthesis
- ✅ Provided clear completion message

### Output Validation

**Research Notes**:
```markdown
[2-3 sentences summarizing key findings]

Key Sources:
- [Source 1]: [Finding] (URL)
- [Source 2]: [Finding] (URL)
- [Source 3]: [Finding] (URL)

Summary: [2 sentences on conclusions]
```

**Final Report**:
- Length: 500-800 words
- Citations: Every claim backed by source
- Structure: Clear organization by theme or subtopic
- Format: Plain text (.txt) or Joplin markdown (.md)

## Error Handling

### Common Issues and Solutions

**Issue**: Researcher saves to wrong location
- **Detection**: Report writer can't find notes
- **Solution**: Verify file paths in agent prompts, ensure `~/Documents/ClaudeResearch/research_notes/` exists

**Issue**: Research notes too sparse
- **Detection**: Report lacks depth or citations
- **Solution**: Ensure researchers run minimum 3 WebSearch queries, extract 3-5 sources

**Issue**: Researchers spawn sequentially instead of parallel
- **Detection**: Total time > 10 minutes for 4 researchers
- **Solution**: Lead coordinator must spawn all researchers in same message block

**Issue**: Report writer can't load files
- **Detection**: Error message or empty report
- **Solution**: Check directory exists, verify file permissions, ensure markdown extension

**Issue**: Missing Joplin formatting
- **Detection**: Plain text output when markdown expected
- **Solution**: Ensure "Joplin" mentioned in original request or synthesis prompt

## Integration Points

### With Joplin Note-Taking

**Trigger**: User mentions "Joplin" in research request

**Workflow Changes**:
1. Report writer loads `joplin-research` skill
2. Output format changes to markdown (.md)
3. Follows Joplin-specific formatting:
   - Table of contents (`>[toc]`)
   - Heading hierarchy (h2, h3 with separators)
   - Proper spacing and typography
   - Escaped advantages/disadvantages

**Example Request**:
```
"Research quantum computing for my Joplin notes"
```

### With External Tools

**Compatible With**:
- Any markdown editor (Obsidian, Notion, etc.)
- Plain text processors
- Version control (Git) for research notes
- CI/CD pipelines for automated research
- Custom reporting tools

**File Format**:
- Research notes: Always markdown (.md)
- Final reports: `.txt` (default) or `.md` (Joplin)

## Best Practices

### For Users

1. **Be Specific**: Clearly state your research topic and scope
2. **Mention Joplin**: If you want markdown formatting, say "Joplin"
3. **Allow Time**: Expect 3-7 minutes for complete research cycle
4. **Check Output**: Verify files at `~/Documents/ClaudeResearch/reports/`

### For Developers

1. **Maintain Parallel Execution**: Never make researchers sequential
2. **Validate File Paths**: Ensure directory structure exists before use
3. **Test End-to-End**: Run complete workflow from request to report
4. **Monitor WebSearch Usage**: Ensure 3-7 queries per researcher minimum
5. **Preserve Citations**: All URLs from WebSearch must appear in notes and reports

## Metrics and Monitoring

### Success Metrics

- **Coverage**: All subtopics investigated
- **Source Quality**: 3-5 authoritative sources per researcher
- **Synthesis Quality**: Coherent narrative with maintained citations
- **Completion Rate**: All phases execute successfully
- **Time Efficiency**: Complete within 3-7 minutes

### Performance Indicators

```
Total Researchers: 4
Queries per Researcher: 3-7
Total Search Queries: 12-28
Research Notes Created: 4
Final Report: 1
Total Time: 3-7 minutes
Speedup vs Sequential: 4x
```
