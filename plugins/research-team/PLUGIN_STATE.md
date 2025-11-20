# Research Team Plugin - Development State

## Current Status

**Version**: 1.0.0
**Status**: Stable
**Last Updated**: 2025-11-17

## Completion Status

### Core Components

- [x] **Agents** (3/3 complete)
  - [x] lead-research-coordinator.md
  - [x] research-specialist.md
  - [x] research-report-writer.md

- [x] **Skills** (1/1 complete)
  - [x] joplin-research/SKILL.md

- [x] **Patterns** (2/2 complete)
  - [x] multi-agent-research.md
  - [x] parallel-research-workflow.md

- [x] **Documentation**
  - [x] README.md
  - [x] PLUGIN_STATE.md (this file)

### Marketplace Integration

- [ ] Added to marketplace.json
- [ ] Added to docs/MARKETPLACE.md
- [ ] Installation tested
- [ ] End-to-end workflow verified

## Implementation Notes

### Conversion from research-team Repository

**Source**: `/Users/andisblukis/Projects/research-team`

**Changes Made**:

1. **Agent Formats**: Converted `.txt` to `.md` with YAML frontmatter
2. **File Paths**: Updated from `files/` to `~/Documents/ClaudeResearch/`
3. **Model Selection**: Changed to `sonnet` (from `haiku`)
4. **Skill Integration**: Copied joplin-research skill (self-contained)
5. **Subagent References**: Updated subagent_type names for consistency
   - `researcher` → `research-specialist`
   - `report-writer` → `research-report-writer`

### Architecture Decisions

1. **Self-Contained Plugin**: Skill copied rather than symlinked for portability
2. **Absolute Paths**: Using `~/Documents/ClaudeResearch/` for consistent output location
3. **Sonnet Model**: Higher quality output for research synthesis
4. **Pattern Documentation**: Added comprehensive workflow and architecture docs

## Testing Checklist

- [ ] YAML frontmatter validates correctly
- [ ] Agent descriptions trigger appropriate activation
- [ ] File paths work on macOS (tested system)
- [ ] Parallel spawning works correctly
- [ ] WebSearch integration functions properly
- [ ] File writing to ~/Documents/ClaudeResearch/ succeeds
- [ ] Report synthesis reads all research notes
- [ ] Joplin skill activates when mentioned
- [ ] Complete research workflow (request → report) works end-to-end
- [ ] marketplace.json syntax valid
- [ ] Plugin installs via /plugin command

## Known Limitations

1. **Platform-Specific**: File paths use Unix-style `~/` (macOS/Linux only)
2. **Fixed Output Location**: Not configurable without editing agent prompts
3. **WebSearch Dependency**: Requires WebSearch tool availability
4. **No Iterative Research**: One-shot research, no user feedback loop
5. **Fixed Subtopics**: 2-4 subtopics limit (could be made configurable)

## Future Enhancements

### Short-Term (v1.1)

- [ ] Add Windows-compatible file paths
- [ ] Make output directory configurable
- [ ] Add research depth presets (light/standard/deep)
- [ ] Error handling for missing directories
- [ ] Validation of WebSearch availability before spawning

### Medium-Term (v1.2)

- [ ] Support for iterative research (user provides feedback)
- [ ] Research archiving and versioning
- [ ] Multiple export formats (PDF, HTML, DOCX)
- [ ] Cross-research citation linking
- [ ] Research template library

### Long-Term (v2.0)

- [ ] Integration with other note-taking apps (Obsidian, Notion)
- [ ] Custom researcher specializations
- [ ] Research quality scoring
- [ ] Automatic subtopic optimization
- [ ] Multi-language research support

## Dependencies

### Required Tools

- **Task**: For spawning subagents (lead coordinator)
- **WebSearch**: For information gathering (researchers)
- **Write**: For saving files (researchers, report-writer)
- **Read**: For reading research notes (report-writer)
- **Glob**: For finding files (report-writer)
- **Skill**: For loading formatting guidelines (report-writer)

### Required Skills

- **joplin-research**: Included in plugin (skills/joplin-research/)

### External Dependencies

- **File system**: Must support Unix-style paths (`~/Documents/`)
- **Directory**: `~/Documents/ClaudeResearch/` must be writable

## Plugin Structure

```
plugins/research-team/
├── agents/
│   ├── lead-research-coordinator.md       (Orchestrator)
│   ├── research-specialist.md             (Web researcher)
│   └── research-report-writer.md          (Report synthesizer)
├── skills/
│   └── joplin-research/
│       └── SKILL.md                       (Markdown formatting)
├── patterns/
│   ├── multi-agent-research.md            (Architecture pattern)
│   └── parallel-research-workflow.md      (Workflow documentation)
├── README.md                              (User documentation)
└── PLUGIN_STATE.md                        (This file)
```

## Version History

### v1.0.0 (2025-11-17)

**Initial Release**

- Converted from research-team repository
- 3 agents: coordinator, specialist, report-writer
- 1 skill: joplin-research
- 2 patterns: architecture and workflow
- Complete documentation
- File-based parallel research workflow
- Joplin integration support

## Maintenance Notes

### Regular Updates Needed

- **Agent Prompts**: Review effectiveness, update based on user feedback
- **WebSearch Queries**: Optimize query templates for better results
- **Report Templates**: Refine synthesis approach based on output quality
- **Documentation**: Keep examples current with latest features

### Compatibility Checks

- **Claude Code Version**: Test with new releases
- **Tool Availability**: Verify Task, WebSearch, Write, Read, Glob, Skill tools
- **File System**: Test on macOS (primary), Linux (secondary)
- **Skill Loading**: Verify joplin-research skill activates correctly

## Support and Issues

### Common Issues

1. **Directory not found**: Ensure `~/Documents/ClaudeResearch/` exists
2. **Permission denied**: Check write permissions on output directory
3. **Researchers spawn sequentially**: Review lead coordinator prompt
4. **Missing citations**: Verify researchers include URLs from WebSearch
5. **Plain text instead of markdown**: Check "Joplin" mentioned in request

### Debugging Steps

1. Check agent frontmatter YAML syntax
2. Verify file paths in agent prompts
3. Test subagent spawning with Task tool
4. Confirm WebSearch returns results
5. Validate file writing to research_notes/
6. Check report-writer reads all files
7. Verify skill activation logic

## Contact

**Plugin Author**: Andis A. Blukis
**Email**: andis.blukis@gmail.com
**Repository**: https://github.com/andisab/swe-marketplace
**Marketplace**: swe-marketplace

## License

MIT License - See repository root for full license text
