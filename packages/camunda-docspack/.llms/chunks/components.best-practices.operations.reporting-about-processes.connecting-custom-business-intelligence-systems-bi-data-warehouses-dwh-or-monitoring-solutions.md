# Reporting about processes — Connecting custom business intelligence systems (BI), data warehouses (DWH), or monitoring solutions

You might move data from the Camunda History to a decoupled system like a Business Intelligence (BI) solution, a Data Warehouse (DWH), some Data Lake, or an own monitoring solution, for example based on Prometheus.

Leveraging typical BI system's **ETL** (extract, transform, and load) features allows you to optimize data structure for your reporting purposes (to _speed up_ report generation) or to combine generic process engine data with business entities (to allow for _more in-depth analysis_).

To get the data into the BI system, leverage one of the mechanisms described above. Our recommendation generally is:

- In SaaS, leverage the history API to regularly pull data, as custom exporters are not supported there.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/reporting-about-processes
