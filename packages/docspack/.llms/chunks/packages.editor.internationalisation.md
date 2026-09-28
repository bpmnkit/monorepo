# @bpmnkit/editor — Internationalisation

The editor and its first-party panels ship in ten languages. English is built in; the
other nine are separate entry points, so a bundle carries only the languages it imports.

| Language | Import |
|---|---|
| German | `@bpmnkit/editor/locales/de` |
| Spanish | `@bpmnkit/editor/locales/es` |
| French | `@bpmnkit/editor/locales/fr` |
| Italian | `@bpmnkit/editor/locales/it` |
| Dutch | `@bpmnkit/editor/locales/nl` |
| Polish | `@bpmnkit/editor/locales/pl` |
| Portuguese (Brazil) | `@bpmnkit/editor/locales/pt-BR` |
| Japanese | `@bpmnkit/editor/locales/ja` |
| Chinese (Simplified) | `@bpmnkit/editor/locales/zh-CN` |

`createTranslate(locale)` turns a locale into the `translate` hook. Pass the same hook to
the editor, the side dock and every plugin you mount:

```typescript
import { BpmnEditor, createSideDock, createTranslate, initEditorHud } from "@bpmnkit/editor";
import { de } from "@bpmnkit/editor/locales/de";
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel";
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn";

const translate = createTranslate(de);
const dock = createSideDock({ translate });
const configPanel = createConfigPanelPlugin({ getDefinitions, applyChange, translate });
const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, { translate });
const editor = new BpmnEditor({ container, translate, plugins: [configPanel, configPanelBpmn] });
initEditorHud(editor); // the HUD reads the editor's hook
```

These plugins take a `translate` option: `config-panel`, `config-panel-bpmn`,
`command-palette`, `command-palette-editor` (third argument), `main-menu`, `history`,
`process-runner`, `tabs` and `storage-tabs-bridge`. The properties panel translates schema
labels, hints, placeholders and option labels when it draws them, so strings from a
connector template you add pass through unchanged.

**Pick the language at runtime.** `AVAILABLE_LOCALES` lists every language with its own
name, and `matchLocale(navigator.languages, codes)` picks the best match for the browser.
Load the chosen locale with a dynamic `import()`, so each language is its own chunk.
The strings are fixed when the UI is built — to switch language, rebuild the editor or
reload the page. The main menu has a ready-made Language section:

```typescript
createMainMenuPlugin({
  translate,
  language: {
    current: "de",
    options: AVAILABLE_LOCALES,
    onSelect(code) {
      localStorage.setItem("editor-locale", code);
      location.reload();
    },
  },
});
```

Set `lang` on the page (or on the editor's container) to the locale's code. Screen readers
use it, and Japanese and Chinese use it to choose the correct form of shared Han characters.
The `--bpmnkit-ds-font-*` tokens in `@bpmnkit/ui` add CJK fallback fonts under `:lang(ja)`
and `:lang(zh)`.

**Keys and plurals.** A key is the English text the UI asks for, such as `"Undo (Ctrl+Z)"` or
`"{count} elements selected"`. A key that a locale does not have falls back to English.
Placeholders in braces must stay the same in every translation. A message can also be a
plural object — `createTranslate` selects its form with `Intl.PluralRules` from `count`:

```typescript
const pl: Locale = {
  code: "pl",
  name: "Polski",
  messages: {
    "{count} elements selected": {
      one: "Zaznaczono {count} element",
      few: "Zaznaczono {count} elementy",
      many: "Zaznaczono {count} elementów",
      other: "Zaznaczono {count} elementu",
    },
  },
};
```

**Your own translation.** A `Translate` is only a function, so you can wrap a shipped
locale to override some strings, or supply a language that is not shipped:

```typescript
const base = createTranslate(de);
const translate: Translate = (key, vars) =>
  key === "Deploy" ? "Deployen" : base(key, vars);
```

The shipped translations are machine-assisted and checked against the BPMN terminology
that Camunda Modeler uses. Corrections are welcome — see "Improving a translation" in
`CONTRIBUTING.md`.

---
Source: https://bpmnkit.com/docs/packages/editor
