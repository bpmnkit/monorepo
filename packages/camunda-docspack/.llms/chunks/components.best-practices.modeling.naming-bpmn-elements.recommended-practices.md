# Naming BPMN elements — Recommended practices

### Using sentence case

Use [sentence case](https://en.wiktionary.org/wiki/sentence_case) when naming BPMN symbols. This is standard capitalization of an English sentence, with the first letter uppercase and subsequent letters lowercase, with exceptions such as proper nouns or acronyms.

Diagram (BPMN): Dinner preparation and intake
  start "Dinner time" → "Prepare dinner" → "Have dinner" → end "Dinner finished"
  lanes: Family member, Chef
  note: Every family member

### Avoiding technical terms

Avoid using purely _technical terms_ when naming activities or other BPMN symbols, for example. These are not always clear to every reader. Completely avoid using names of coding artifacts like classes, methods, technical services, or purely technical systems.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-bpmn-elements
