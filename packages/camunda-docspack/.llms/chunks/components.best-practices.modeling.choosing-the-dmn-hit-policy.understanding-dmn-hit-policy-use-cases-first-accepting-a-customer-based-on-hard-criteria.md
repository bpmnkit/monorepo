# Choosing the DMN hit policy — Understanding DMN hit policy use cases — First: accepting a customer based on hard criteria

Having said that, the hit policy "**First**" can sometimes make it easier for an organization to reason about decision logic dealing with some criteria that are "harder" (more "clearcut") than others. Furthermore, it can help to make a decision table layout more compact and therefore easier to interpret.

**(1)**

Assume that everybody in the organization knows that first rule: "Once on the blocklist, never again accepted." The layout and the hit policy of the decision table therefore supports the organization's way of doing business: once we know that single fact about a customer, we don't need to think further.

**(2)**

The following rules from row 2-4 are expressed in an "Accept" manner and might change more often over time. The organization's way of thinking is literally "from top to bottom". Once we find an acceptance rule, we can deal with the customer.

**(3)**

For execution in a decision engine, don't forget to add a rule not accepting any other customers as a last row.

In scenarions dealing with **hard** **exclusion** and **inclusion** criteria, we often don't care that much if the rules overlap, but prefer to argue about very clearcut cases first and about more sophisticated ones later on. Furthermore, the organization's way of thinking and doing business might be better supported by a decision table using the hit policy **First**.

Our experience so far tends to show that it can be more tricky and error prone to argue about a **First** hit policy decision table than it might occur to you at first sight. Therefore, be especially careful and always test your logic in case you are dealing with sensitive business!

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-dmn-hit-policy
