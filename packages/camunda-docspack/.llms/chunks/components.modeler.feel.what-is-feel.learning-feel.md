# What is FEEL? — Learning FEEL

To understand FEEL better and how it is integrated into Camunda, you can explore the following resources:

- [Expressions in Camunda 8](https://docs.camunda.io/docs/next/components/concepts/expressions): Learn how expressions are used within our platform.
- [FEEL syntax and operators](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-expressions-introduction): Learn how to write basic expression.
- [Built-in functions](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-introduction): Read about functions the FEEL engine offers.


## FEEL engines

To evaluate your expressions, Camunda employs two distinct FEEL engines depending on the use-case: FEEL Scala (the Java FEEL engine) and feelin (the JavaScript FEEL engine). Both support the basic FEEL syntax and functions. You can try out your expressions in our playgrounds outlined below.

### FEEL Scala (Java FEEL engine)

[**FEEL Scala**](https://github.com/camunda/feel-scala) is a Java-based FEEL engine integrated into the backend of our platform. It is primarily responsible for evaluating expressions in BPMN diagrams and DMN tables.

**Info: <a id="camunda-extensions">info</a>**

The FEEL Scala engine supports a set of extensions to standard DMN FEEL. The documentation marks them via the following tag:

(Camunda extension)

Try out expressions in the [FEEL Scala Playground](https://camunda.github.io/feel-scala/docs/playground/).

### feelin (JavaScript FEEL engine)

[**feelin**](https://github.com/nikku/feelin) is a JavaScript-based FEEL engine designed for use in the browser is used for [Camunda Forms](https://docs.camunda.io/docs/next/components/modeler/forms/camunda-forms-reference) and [templating](https://docs.camunda.io/docs/next/components/modeler/forms/configuration/forms-config-templating-syntax). [Camunda extensions](#camunda-extensions) are **not** currently supported by feelin.

Try out expressions in the [feelin Playground](https://nikku.github.io/feel-playground/).

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/what-is-feel
