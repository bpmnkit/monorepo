# Testing Processes — Matchers

| Matcher | Passes when |
|---|---|
| `toHaveCompleted()` | The instance ended normally |
| `toHaveFailed(error?)` | The instance failed. `error` is a substring or a `RegExp` |
| `toBeWaitingAt(ids)` | Each listed element holds a token now |
| `toHavePassed(ids)` | Each listed element completed at least once, in any order |
| `toHavePassedInOrder(ids)` | The elements completed in this order. Other elements can come between them |
| `toHaveNotPassed(ids)` | None of the listed elements completed |
| `toHaveVariables(vars)` | Each listed variable is equal. Asymmetric matchers such as `expect.any(Number)` work |

Every matcher works with `.not`. When a matcher fails, the message gives the run's state,
its error, the elements that wait and the elements that completed.

---
Source: https://bpmnkit.com/docs/guides/testing-processes
