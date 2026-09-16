# Following the customer success path — Estimating effort

When starting your BPM project, it is often necessary to roughly estimate the expected effort. A process model can serve as a central artifact for estimation purposes. Avoid too fine-grained estimations as they typically are not worth the effort.

However, on a management level one often must have some estimations to secure budgets, get projects started, allocate needed resources, and communicate expected time frames. The success factor is to do estimations _on a very rough level_ and avoid spending too much time with details. More often than not, the details develop differently than expected anyway.

We often note customers successfully estimate _T-Shirt size categories (S, M, L, XL and XXL)_. Such an approach is sufficient for us to make roughly informed decisions about priority and return on investment.

![T-Shirts](following-the-customer-success-path-assets/t-shirts.png)

Having said that, your organization may demand that you _map_ such rough sizes to some measuring system already used; for example, _story points_ or _person days_. To preserve the rough character, consider mapping the sizes by using a series of sharply increasing numbers:

| S   | M   | L   | XL  | XXL |
| --- | --- | --- | --- | --- |
| 2   | 5   | 13  | 50  | 200 |

Much more important than concrete numbers is an educated gut feeling. Therefore, try to understand the influencing factors determining most of the effort by implementing your lighthouse process.

### Using the process model for estimation

A process model can be seen as a central artifact for estimation purpose, as it indicates and visually maintains a lot of the influencing factors mentioned above.

Diagram (BPMN): Invoice Receipt
  start "Invoice received" → user task "Assign Approver" → exclusive gateway → user task "Approve Invoice" → exclusive gateway "Invoice approved?"
    — [No: =not(approved)] user task "Review Invoice" → exclusive gateway "Review successful?"
      — [Yes: =successful] (back to exclusive gateway)
      — [No: =not(successful)] end "Invoice not processed"
    — [Yes: =approved] user task "Prepare Bank Transfer" → service task "Archive Invoice" → end "Invoice processed"
  lanes: Team Assistant, Accountant, Approver

Here are the figures you could estimate:

1. Setting up development environment: **S**
2. Modeling and understanding requirements: **L**
3. Implementing the process solution:

**(1)**
**(2)**
**(6)**

4. Going live: **M**

Using the process model, you can also foresee potential effort drivers, for example:

- The legacy archive is really hard to integrate.
- The tasks need to be integrated into an existing legacy task list, which might not be straight forward to do.
- The metadata from the PDF shall be extracted, and a specialized form be shown to the user.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/management/following-the-customer-success-path
