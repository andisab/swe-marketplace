---
name: report-formats
description: >
  Output formats and report templates for the research-team plugin's reports.
  The research-report-writer agent loads this skill for every report. It also
  applies when a user asks for a research report, technical survey, decision
  brief, landscape scan, what's-new digest or source summary in a particular
  editor's format: plain Markdown (the default, for VS Code, Cursor and GitHub),
  Obsidian or Joplin. Do not load it for Joplin or Obsidian tasks that aren't
  research reports.
---

A report is a Markdown file that reads correctly wherever Markdown renders. Pick the format profile from the request, then the report type from what the research produced.

## Format profiles

Choose the profile from the words in the request. "For my Obsidian vault" picks Obsidian, "for Joplin" picks Joplin, and anything else picks Markdown. When the request states a folder to save into, use it instead of the default `~/Documents/Claude/Research/reports/`.

**Markdown (default).** GitHub-flavored Markdown with no editor-specific syntax. It renders the same in VS Code, Cursor, GitHub and most note apps. One `#` title, `##` sections, `###` subsections. Links as `[text](url)`. Tables for comparisons. Plain Markdown only: HTML and front matter belong to the editor profiles.

**Obsidian.** Markdown plus a YAML properties block at the top, so the vault can index the note:

```markdown
---
title: Vector database pricing
date: 2026-10-22
tags: [research, databases]
sources: 6
---
```

Use Obsidian callouts for the summary and any caveat, such as `> [!summary]` and `> [!warning]`. Use `[[wikilinks]]` only for notes the request names; don't invent links to notes that may not exist.

**Joplin.** Markdown with `>[toc]` on the first line, which Joplin renders as a table of contents. Joplin's default stylesheet draws a rule under `#` and `##` headings, so don't add `---` beneath them. Save the file; the user imports it with **File → Import → MD**. A Joplin formatting skill installed by the user (for example in `~/.claude/skills/`) overrides this profile.

## Report types

Pick the type that matches what the notes contain, and read its reference file for the section list. Each is 500 to 800 words unless the coordinator's prompt sets another length.

| Type | Use it when | Reference |
|---|---|---|
| Technical survey | The notes compare several tools, services or approaches | `references/technical-survey.md` |
| Technical rundown | The notes cover one tool, library or platform in depth | `references/technical-rundown.md` |
| Decision brief | The user has to choose, and the notes support a recommendation | `references/decision-brief.md` |
| Landscape scan | The notes map a field: who does what, where it's going | `references/landscape-scan.md` |
| What's new | The notes cover recent changes to one product, standard or field | `references/whats-new.md` |
| Source summary | The notes summarize one article, paper, whitepaper or book | `references/source-summary.md` |

When none fits, use the landscape scan's sections.

## Rules for every report

- Every claim has a citation, as a link to the source in the research notes. Don't add sources the notes don't have.
- Give numbers with their date and source, and say than what when a thing is faster, cheaper or larger.
- Keep the exact names of products, versions, limits and prices.
- Where the notes disagree, say so and give both sources.
- End with a sources list, one line per source, in the order first cited.
