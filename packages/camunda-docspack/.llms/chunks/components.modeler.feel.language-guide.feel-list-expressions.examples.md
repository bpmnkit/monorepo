# List expressions — Examples

### Filter list and return the first element

Return the first packaging element which unit is "Palette".

```feel
data.attribute.packaging[unit = "Palette"][1]
```

### Group list

Group the given list of invoices by their person.

Each invoice has a person. The persons are extracted from the invoices and are used as a filter for the list.

```feel
for p in distinct values(invoices.person) return invoices[person = p]
```

#### Evaluation context

```feel
{"invoices":[
  {"id":1, "person":"A", "amount": 10},
  {"id":2, "person":"A", "amount": 20},
  {"id":3, "person":"A", "amount": 30},
  {"id":4, "person":"A", "amount": 40},
  {"id":5, "person":"B", "amount": 15},
  {"id":6, "person":"B", "amount": 25}
]}
```

#### Evaluation result

```feel
[
  [
    { id: 1, person: "A", amount: 10 },
    { id: 2, person: "A", amount: 20 },
    { id: 3, person: "A", amount: 30 },
    { id: 4, person: "A", amount: 40 },
  ],
  [
    { id: 5, person: "B", amount: 15 },
    { id: 6, person: "B", amount: 25 },
  ],
]
```

### Merge two lists

Merge two given lists. Each list contains context values with the same structure. Each context has an `id` entry that identifies the value.

The result is a list that contains all context values grouped by the identifier.

```feel
 {
   ids: union(x.files.id,y.files.id),
   getById: function (files,fileId) get or else(files[id=fileId][1], {}),
   merge: for id in ids return context merge(getById(x.files, id), getById(y.files, id))
 }.merge
```

#### Evaluation context

```feel
{
 "x": {"files": [
   {"id":1, "content":"a"},
   {"id":2, "content":"b"}
 ]},
 "y": {"files": [
   {"id":1, "content":"a2"},
   {"id":3, "content":"c"}
 ]}
}
```

#### Evaluation result

```feel
[
  { id: 1, content: "a2" },
  { id: 2, content: "b" },
  { id: 3, content: "c" },
]
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-list-expressions
