# Instructions

<!-- Part 1 & 2: Portable across repos. Do NOT add repo-specific rules here. -->
<!-- Repo-specific instructions go in .github/instructions/repo.instructions.md -->

## Part 1 — Behavioral Guidelines

### Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## Part 2 — General Coding Quality

### Code Correctness

- Zero compiler/type errors. Always.
- Zero linting warnings. Always.
- All existing tests must pass after your changes.
- If you change behavior, update or add tests to cover it.

### Formatting & Linting

- Run the project's formatter and linter before considering any task complete.
- Never submit code that fails formatting or linting checks.
- Match the project's existing formatting configuration — do not override it.

### Testing

- Write tests for new functionality.
- Bug fixes must include a regression test.
- Don't delete or skip existing tests unless explicitly asked.
- Tests must be deterministic — no flaky assertions, no timing dependencies.

### Error Handling

- Handle errors at the appropriate level — don't swallow them silently.
- Provide actionable error messages that help debugging.
- Fail fast on invalid input — don't let bad data propagate.

### Security

- Never commit secrets, tokens, or credentials.
- Validate and sanitize all external input.
- Use parameterized queries for database access.
- Prefer established security libraries over hand-rolled solutions.

### Performance

- Consider performance implications of your changes.
- Avoid unnecessary allocations, copies, or iterations.
- Don't optimize prematurely — but don't write obviously slow code either.

### Documentation

- Update documentation when your changes affect public APIs or user-facing behavior.
- Code comments explain *why*, not *what*. The code itself should explain *what*.
- Don't add comments that merely restate the code.

### Pre-Completion Checklist

Before finishing any task, verify:
1. The project builds with zero warnings and zero errors.
2. Formatting and linting pass.
3. Type checking passes with zero errors.
4. All tests pass.

<!-- Part 3: Everything below is specific to THIS repository. -->
<!-- Parts 1 & 2 (behavioral + coding quality) live in .github/copilot-instructions.md -->

## Tech Stack

- **Architecture:** Turborepo monorepo
- **Language:** TypeScript (strict mode) — latest stable
- **Runtime:** Node.js — latest LTS
- **Package Manager:** pnpm (workspaces)
- **Build System:** Turborepo
- **Testing:** Vitest
- **Linting & Formatting:** Biome
- **Frontend:** React with Carbon Design System
- **State Management:** Zustand (preferred over raw React hooks for all state management)
- **Dependencies:** Latest versions only; prefer mature, well-maintained packages
- **Dependency Policy:** Only add external packages when functionality cannot be reasonably implemented in-repo

## Project Structure

Follow Turborepo best practices:

```
apps/
  backend/         # Node.js backend (ESM)
  frontend/        # React frontend (Carbon Design System)
packages/
  shared/          # Shared types, utilities, constants
  ui/              # Shared UI components (if needed)
  config/          # Shared configuration (TypeScript, Biome, etc.)
turbo.json         # Turborepo pipeline configuration
package.json       # Root package.json (all devDependencies here)
biome.json         # Biome configuration
```

## Dependency Management

- **All `devDependencies` must be declared in the root `package.json`** — never in individual app or package `package.json` files
- Runtime `dependencies` belong in the respective app/package `package.json`

## Build & Check Commands

- Build: `pnpm turbo build`
- Lint & Format: `pnpm turbo check` or `pnpm biome check .`
- Typecheck: `pnpm turbo typecheck` or `pnpm tsc --noEmit`
- Test: `pnpm turbo test`

## Backend Guidelines

- **ESM only** — use `"type": "module"` in `package.json`, use `.js` extensions in imports
- Follow latest Node.js best practices and recommendations
- Use modern APIs: `fetch`, `node:` protocol imports, top-level `await`
- Prefer native Node.js APIs over third-party packages where possible
- Structure code for testability and separation of concerns

## Frontend Guidelines

- **React** with **Carbon Design System** (`@carbon/react`) for all UI components
- **Zustand** for state management — centralize state in stores, avoid scattering `useState`/`useEffect` across components
- Only use raw React hooks (`useState`, `useEffect`, `useRef`, etc.) when Zustand or Carbon components do not cover the use case
- Prefer Carbon's built-in component patterns and design tokens over custom styling
- Optimize for render performance: minimize re-renders, use selectors in Zustand stores

## Brand Tokens

All brand colors and design tokens are defined in **`packages/ui`** (`@bpmn-sdk/ui`).

- **Single source of truth**: edit `packages/ui/src/tokens.css` (CSS file) or `packages/ui/src/css.ts` (`UI_TOKENS_CSS` string) — both must stay in sync
- **Token namespace**: all public tokens use `--bpmn-*` prefix
- **Usage in packages**: call `injectUiStyles()` at runtime (editor, canvas, plugins), or `@import "@bpmn-sdk/ui/tokens.css"` in Astro apps via `packages/astro-shared`
- **Never hardcode brand colors** — always use `var(--bpmn-*, <fallback>)` with a hex fallback so packages work standalone
- **Semantic colors are exempt**: execution-state colors (token-highlight amber/green), syntax highlighting (feel-playground, dmn-viewer), and DMN semantic section colors must not be replaced with brand tokens

### Key tokens

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bpmn-bg` | `#f4f4f8` | `#0d0d16` | Page background |
| `--bpmn-surface` | `#ffffff` | `#161626` | Card / panel surface |
| `--bpmn-surface-2` | `#eeeef8` | `#1e1e2e` | Elevated surface |
| `--bpmn-border` | `#d0d0e8` | `#2a2a42` | Borders |
| `--bpmn-fg` | `#1a1a2e` | `#cdd6f4` | Primary text |
| `--bpmn-fg-muted` | `#6666a0` | `#8888a8` | Secondary text |
| `--bpmn-accent` | `#1a56db` | `#6b9df7` | Primary accent / interactive |
| `--bpmn-accent-bright` | `#3b82f6` | `#89b4fa` | Bright accent / links |
| `--bpmn-accent-subtle` | `rgba(26,86,219,0.12)` | `rgba(107,157,247,0.15)` | Accent tint / hover bg |
| `--bpmn-teal` | `#0d9488` | `#2dd4bf` | Secondary accent |
| `--bpmn-panel-bg` | `rgba(255,255,255,0.92)` | `rgba(13,13,22,0.92)` | Floating panels |
| `--bpmn-panel-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Panel borders |
| `--bpmn-success` | `#16a34a` | `#22c55e` | Success state |
| `--bpmn-warn` | `#d97706` | `#f59e0b` | Warning state |
| `--bpmn-danger` | `#dc2626` | `#f87171` | Error / danger state |
| `--bpmn-font` | `system-ui, -apple-system, sans-serif` | same | UI font |
| `--bpmn-font-mono` | `ui-monospace, "Cascadia Code", "JetBrains Mono", monospace` | same | Monospace font |

## TypeScript Practices

- Prefer compile-time (type-level) guarantees over runtime checks
- Write idiomatic TypeScript: use discriminated unions, template literals, and branded types where appropriate
- TypeScript strict mode — zero type errors across the entire monorepo
- Biome — zero warnings, zero errors

## Documentation Requirements

| File                   | Purpose                                            | Update Frequency           |
| ---------------------- | -------------------------------------------------- | -------------------------- |
| `README.md`            | Brief intro, motivation, prerequisites, quickstart | On significant changes     |
| `doc/progress.md`      | Historical changelog                               | **Every change**           |
| `doc/features.md`      | High-level feature list with timestamps            | When features are added    |
| `doc/documentation.md` | Detailed CLI usage documentation                   | When features change       |
| `doc/roadmap.md`       | Implementation roadmap with action items           | Check items when completed |

### Roadmap Tracking

When completing action items from `doc/roadmap.md`:

- Mark completed items with `[x]` instead of `[ ]`
- Keep the roadmap up-to-date as features are implemented