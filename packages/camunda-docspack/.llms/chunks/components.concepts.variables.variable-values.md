# Variables — Variable values

The value of a variable is stored as a JSON value. It can have one of the following types:

- String (e.g. `"John Doe"`)
- Number (e.g. `123`, `0.23`)
- Boolean (e.g. `true` or `false`)
- Array (e.g. `["item1" , "item2", "item3"]`)
- Object (e.g. `{ "orderNumber": "A12BH98", "date": "2020-10-15", "amount": 185.34}`)
- Null (`null`)

**Note**
Numbers are subject to the following numeric limits:

- Integer numbers are effectively limited to the 64‑bit integer range.
- Non‑integer numbers are stored as IEEE‑754 double‑precision values, which provide roughly 15–17 significant decimal digits rather than arbitrary BigDecimal precision.

If you need arbitrary-precision or very large numbers, consider storing them as strings or in an external data store instead of process variables.

---
Source: https://docs.camunda.io/docs/next/components/concepts/variables
