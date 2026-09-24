---
"@bpmnkit/ui": patch
---

`createThemeSwitcher`: clicking the button while the dropdown is open now closes it. Before, the outside-click handler treated the button as outside, so the button's `pointerdown` closed the dropdown and the click that followed opened it again. The outside-click handler is also removed whenever the dropdown closes, so a handler left behind by an earlier dropdown can no longer close the next one before a selection registers.
