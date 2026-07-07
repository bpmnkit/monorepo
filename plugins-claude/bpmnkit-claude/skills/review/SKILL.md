---
name: review
description: Run the full static analyzer on a BPMN file and report deploy-readiness. Usage: /bpmnkit:review [file.bpmn]
---

Review the BPMN file for issues: $ARGUMENTS

## 1. Determine the target file

If $ARGUMENTS names a `.bpmn` file, use it. Otherwise run `ls *.bpmn` in the current directory: if exactly one exists, use it; if multiple, list them and ask.

## 2. Run both profiles

```sh
casen lint lint <file>.bpmn --profile deploy --format json
casen lint lint <file>.bpmn --format json
```

(`lint`'s flag is `--format`, not `--output` — don't confuse it with `synth`'s `--output <path>`, which writes to a file and is a different flag on a different command.)

The first is the deploy-readiness gate (errors only, across every category: `flow`, `naming`, `feel`, `feel-syntax`, `deploy`, `agentic`, `connector`, `pattern`, `data-flow`, `task-reuse`, `extract`). The second is the full report including warnings/info.

## 3. Present findings grouped by severity

```
**Errors** (must fix before deploy)
- [element-id] [category] message. Fix: suggestion, if present.

**Warnings** (should fix)
- ...

**Info** (consider)
- ...
```

Ignore `data-flow` info/warning findings against an `aiAgent` step's own provider/model/prompt bindings — see `references/agentic.md`'s "Known noisy finding" note; they're a known analyzer limitation, not a real issue.

## 4. Offer auto-fix

If there are any findings at all, offer to run:

```sh
casen lint lint <file>.bpmn --fix
```

This applies every auto-fixable finding and writes the result back (the CLI reports how many were fixed, or "No auto-fixable issues found."). Re-run step 2 afterward to confirm.

## 5. Explicit verdict

End with one line: **"Deploy-ready: yes"** (zero errors from the deploy profile) or **"Deploy-ready: no — N error(s)"**.
