# src/markdown/

Markdown parsing and rendering utilities.

## Key Files

| File             | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `ir.ts`          | Internal representation for parsed markdown     |
| `render.ts`      | Renders IR back to text (plain, Telegram, etc.) |
| `tables.ts`      | Table parsing and formatting                    |
| `fences.ts`      | Code fence parsing                              |
| `frontmatter.ts` | YAML frontmatter extraction                     |

## Purpose

Handles markdown processing throughout crocbot — parsing agent responses for channel delivery (e.g., converting markdown to Telegram-compatible formatting), extracting frontmatter from skill files, and rendering tables in CLI output.
