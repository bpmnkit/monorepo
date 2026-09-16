# Metadata

Attach searchable key-value metadata to cluster variables so consumers can discover and filter them without inspecting their values.

Attach searchable key-value metadata to cluster variables so consumers can discover and filter them without inspecting their values.


## About metadata

Each cluster variable can include optional metadata: a map of string keys to scalar values. Metadata is stored alongside the variable but kept separate from its `value`.

You can use metadata to annotate variables with information that helps you find them. For example, you could annotate a cluster variable containing a country’s VAT rate with `category=TAX_RATE`, `region=EU`, and `year=2026`. You can then query for all tax rates for a given region and year without knowing the variables’ actual content.

Camunda does not interpret metadata keys or values or assign meaning to missing metadata. You can provide empty metadata or omit it entirely.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/metadata
