# @bpmnkit/editor — HUD Options

```typescript
type HudOptions = {
  optimizeButton?: HTMLElement;   // inject an external "Optimize" button
  aiButton?: HTMLElement;         // inject an external "AI" button
};
```


## EditorOptions

```typescript
type EditorOptions = {
  container: HTMLElement;
  theme?: "dark" | "light";
  persistTheme?: boolean;         // auto-save theme to localStorage
  plugins?: CanvasPlugin[];
};
```


## SideDock API

```typescript
type SideDock = {
  el: HTMLElement;
  propertiesPane: HTMLElement;
  aiPane: { button: HTMLElement; el: HTMLElement };
  switchTab(tab: "properties" | "ai"): void;
  expand(): void;
  collapse(): void;
  collapsed: boolean;
  showPanel(): void;
  hidePanel(): void;
  setDiagramInfo(processName: string, fileName: string): void;
};
```

---
Source: https://docs.bpmnkit.com/packages/editor/
