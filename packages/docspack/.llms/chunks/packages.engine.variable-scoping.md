# @bpmnkit/engine — Variable Scoping

Variables follow Zeebe's scope rules:

- The process, each embedded or event sub-process, each multi-instance iteration and each
  element with an IO mapping has its own scope
- Input mappings create local variables of the element
- A result — job variables, a script or decision result, a message or signal payload, a child
  process's variables — updates the variable in the nearest scope that defines it, or creates
  it in the process scope. With output mappings, the result stays local to the element and
  only the mapped variables leave it
- A sub-process's local variables are dropped when it completes unless an output mapping
  carries them out
- `inputElement` and `loopCounter` are local to a multi-instance iteration; the
  `outputCollection` reaches the enclosing scope when the loop completes

---
Source: https://bpmnkit.com/docs/packages/engine
