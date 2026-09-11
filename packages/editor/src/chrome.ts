import { injectStyle } from "./inject.js"

/** ID used to prevent duplicate chrome-token injection. */
export const CHROME_STYLE_ID = "bpmnkit-chrome-tokens-v1"

/**
 * Theme variables for every piece of editor chrome — the HUD, the side dock and
 * each `@bpmnkit/plugins` panel.
 *
 * The bpmnkit.com design system supplies the *form* (flat: no shadow, gradient
 * or blur; square; depth is a 1px hairline), the *accent* and — since the shell
 * moved onto the brief's `--canvas` ground — the *default ground* as well. Dark
 * and the deliberate `neon` white-label theme are opt-in from there.
 *
 * Declaring them once here is what lets a panel stylesheet be a single set of
 * rules instead of three near-identical copies. The attribute is the one the
 * editor already owns: `data-bpmnkit-hud-theme` on `document.body`, which the
 * HUD stamps with the canvas theme. Absent, chrome reads light — matching
 * `@bpmnkit/canvas`, where light is likewise the themeless default.
 *
 * Values resolve from the `--bpmnkit-ds-*` tokens that `@bpmnkit/ui` owns, with
 * a literal fallback so a package works standalone.
 */
export const CHROME_CSS = `
:root {
  --bpmnkit-chrome-ground: var(--bpmnkit-ds-surface, #ffffff);
  --bpmnkit-chrome-ground-2: var(--bpmnkit-ds-bg, #f4f5f7);
  --bpmnkit-chrome-line: var(--bpmnkit-ds-line, #d8dbe0);
  --bpmnkit-chrome-line-soft: var(--bpmnkit-ds-line-soft, #e4e6ea);
  --bpmnkit-chrome-ink: var(--bpmnkit-ds-ink, #14161a);
  --bpmnkit-chrome-ink-2: var(--bpmnkit-ds-ink-2, #4b5158);
  --bpmnkit-chrome-ink-4: var(--bpmnkit-ds-ink-4, #8b929c);
  --bpmnkit-chrome-accent: var(--bpmnkit-ds-accent, #a8503a);
  --bpmnkit-chrome-accent-fg: #ffffff;
  --bpmnkit-chrome-accent-subtle: rgba(168, 80, 58, 0.1);
  --bpmnkit-chrome-hover: var(--bpmnkit-ds-bg, #f4f5f7);
  /* A scrim is a dark veil over either ground, so it is not per-theme here. */
  --bpmnkit-chrome-scrim: color-mix(in srgb, var(--bpmnkit-ds-dark, #14161a) 62%, transparent);
  --bpmnkit-chrome-font: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
  --bpmnkit-chrome-mono: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, monospace);
}

[data-bpmnkit-hud-theme="dark"] {
  --bpmnkit-chrome-ground: var(--bpmnkit-panel-bg, #0d0d16);
  --bpmnkit-chrome-ground-2: rgba(255, 255, 255, 0.04);
  --bpmnkit-chrome-line: var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.14));
  --bpmnkit-chrome-line-soft: rgba(255, 255, 255, 0.08);
  --bpmnkit-chrome-ink: var(--bpmnkit-ds-ink-on-dark, #f4f5f7);
  --bpmnkit-chrome-ink-2: var(--bpmnkit-ds-ink-on-dark-2, #c8ccd2);
  --bpmnkit-chrome-ink-4: var(--bpmnkit-ds-ink-muted, #9aa1aa);
  --bpmnkit-chrome-accent: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --bpmnkit-chrome-accent-fg: var(--bpmnkit-ds-dark, #14161a);
  --bpmnkit-chrome-accent-subtle: rgba(201, 117, 92, 0.14);
  --bpmnkit-chrome-hover: rgba(255, 255, 255, 0.07);
}

/* Neon is a deliberate white-label theme and keeps its own hue. */
[data-bpmnkit-hud-theme="neon"] {
  --bpmnkit-chrome-ground: oklch(8% 0.03 270);
  --bpmnkit-chrome-ground-2: oklch(65% 0.28 280 / 0.06);
  --bpmnkit-chrome-line: oklch(65% 0.28 280 / 0.28);
  --bpmnkit-chrome-line-soft: oklch(65% 0.28 280 / 0.15);
  --bpmnkit-chrome-ink: oklch(88% 0.02 270);
  --bpmnkit-chrome-ink-2: oklch(73% 0.16 280);
  --bpmnkit-chrome-ink-4: oklch(50% 0.06 280);
  --bpmnkit-chrome-accent: oklch(72% 0.18 185);
  --bpmnkit-chrome-accent-fg: oklch(8% 0.03 270);
  --bpmnkit-chrome-accent-subtle: oklch(72% 0.18 185 / 0.14);
  --bpmnkit-chrome-hover: oklch(65% 0.28 280 / 0.12);
  --bpmnkit-chrome-scrim: oklch(5% 0.025 270 / 0.7);
}
`

/** Injects the shared chrome tokens into `<head>` if not already present. */
export function injectChromeStyles(): void {
	injectStyle(CHROME_STYLE_ID, CHROME_CSS)
}
