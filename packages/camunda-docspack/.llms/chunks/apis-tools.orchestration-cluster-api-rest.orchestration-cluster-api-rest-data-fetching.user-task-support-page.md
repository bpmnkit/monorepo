# Data fetching — User task support — Page

The page object details how to slice the result set. An initial search request can omit the page object or define the `limit`. This specifies the maximum number of results to retrieve per request. Subsequent requests can either use **cursor** or **offset pagination** to iterate through the result set.

Cursor pagination bases on the value of the [search response's](#search-responses) `startCursor` and `endCursor`. Copy `startCursor` into `before` or `endCursor` into `after` to page through results respectively. The [search example](#search-example) showcases how to use these attributes for cursor pagination.

Offset pagination uses the `from` attribute to define the starting point of the next set of items in the overall result set.

**Note**
Choosing the right pagination type depends on the specific use case. The expected result set size and intended usage of the results have the biggest influence. The expected reliability and performance of the search request affect this decision as well.

Consider using cursor pagination for larger result sets and displaying result list that scroll infinitely.
Paged result sets can be realized with offset pagination in a straightforward way but come with performance penalties for larger result sets.

Example

```
POST /v2/user-tasks/search

{
  "page": {
    "limit": 3
  }
}
```

This limits the result set returned in the response to 3 items, no matter how many overall results exist.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching
