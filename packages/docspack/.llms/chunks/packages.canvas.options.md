# @bpmnkit/canvas — Options

```typescript
type CanvasOptions = {
  container: HTMLElement;
  theme?: "dark" | "light";
  plugins?: CanvasPlugin[];
};
```


## API

| Method | Description |
|---|---|
| `canvas.loadXML(xml)` | Load and render a BPMN XML string |
| `canvas.getXML()` | Return the currently loaded XML |
| `canvas.setTheme(theme)` | Switch between dark and light theme |
| `canvas.on(event, handler)` | Subscribe to canvas events |
| `canvas.off(event, handler)` | Unsubscribe a handler |
| `canvas.destroy()` | Clean up the canvas and remove from DOM |

---
Source: https://bpmnkit.com/docs/packages/canvas
