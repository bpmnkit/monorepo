---
"@bpmnkit/editor": minor
"@bpmnkit/plugins": minor
"@bpmnkit/ui": patch
---

The editor ships in ten languages. English stays built in; German, Spanish, French, Italian,
Dutch, Polish, Portuguese (Brazil), Japanese and Chinese (Simplified) are separate entry points
(`@bpmnkit/editor/locales/de` and so on), so a bundle carries only the languages it imports.
The translations are machine-assisted and use the BPMN terms Camunda Modeler uses; corrections
are welcome (see "Improving a translation" in `CONTRIBUTING.md`).

- `@bpmnkit/editor`: `createTranslate(locale)` builds the existing `Translate` hook from a
  locale. Messages can be plural objects, chosen with `Intl.PluralRules` from `count`. Also new:
  the `Locale`, `LocaleMessage` and `PluralMessage` types, `AVAILABLE_LOCALES` (every language
  with its own name, for a picker), `matchLocale()` (the best match for `navigator.languages`),
  and `createSideDock({ translate })`. The HUD, dock, menus, dialogs and screen-reader
  announcements now translate every string. Before, many of them — the undo tooltips, the
  more-actions menu, the start screen, the link buttons and the dock tabs — were always
  English. A mouse wheel now scrolls the dock's tab strip when a long language overflows it,
  and the element-group picker measures its own width, so a long group name does not push it
  past the canvas edge.
- `@bpmnkit/plugins`: new optional `translate` option on `config-panel`, `config-panel-bpmn`,
  `command-palette`, `command-palette-editor` (third argument), `main-menu`, `history`,
  `process-runner`, `tabs` and `storage-tabs-bridge`. The properties panel translates schema
  labels, hints, placeholders and option labels when it draws them. Strings it does not know,
  such as connector template names, pass through unchanged. The panel header now shows the
  element's name ("Service Task") instead of its type id ("serviceTask"). `main-menu` has an
  optional Language section (`language: { current, options, onSelect }`), and `MenuAction`
  has an optional `checked` flag. The play-mode chaos summary reads "unhandled errors: 2",
  which avoids a wrong English plural.
- `@bpmnkit/ui`: `:lang(ja)` and `:lang(zh)` add CJK fallback faces to
  `--bpmnkit-ds-font-sans` and `--bpmnkit-ds-font-mono`, so Japanese and Chinese text picks
  the correct form of shared Han characters.
