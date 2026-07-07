---
description: Review a BPMN file and report findings with severity and an explicit deploy-ready verdict.
---

@.claude/aikit.md

Review the BPMN file: $ARGUMENTS

If no file is given, find the single `.bpmn` in cwd or ask.

## Step 1 — Run both profiles

```sh
casen lint lint <file>.bpmn --profile deploy --format json
casen lint lint <file>.bpmn --format json
```

## Step 2 — Present findings grouped by severity

**Errors** (must fix before deploy)
- `[element-id]` `[category]` message. Fix: suggestion, if present.

**Warnings** (should fix)
- ...

**Info** (consider)
- ...

## Step 3 — Offer auto-fix

If there are any findings, offer:

```sh
casen lint lint <file>.bpmn --fix
```

Re-run Step 1 afterward to confirm.

## Step 4 — Explicit verdict

End with: **"Deploy-ready: yes"** (zero errors from the deploy profile) or **"Deploy-ready: no — N error(s)"**.
