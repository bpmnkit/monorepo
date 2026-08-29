# AIKit Skills

`casen` ships four lightweight Claude Code slash commands that automate the process
development lifecycle — from natural language description to deployed, running process.
They drive `casen` directly (no MCP server, no proxy daemon).

For the full skill set — `/bpmnkit:implement`, `:extend`, `:agent`, `:connect`, plus generated
reference docs the skills read before authoring a plan — install the
[Claude Code plugin](/docs/guides/ai-implement#the-claude-code-plugin) instead.


## Installation

```sh
casen skills install
```

Copies the skill files into `.claude/commands/` in the current project directory.
Once installed, they appear in Claude Code's slash command picker.

```sh
# Reinstall or overwrite existing skills
casen skills install --force
```

---

---
Source: https://bpmnkit.com/docs/cli/skills
