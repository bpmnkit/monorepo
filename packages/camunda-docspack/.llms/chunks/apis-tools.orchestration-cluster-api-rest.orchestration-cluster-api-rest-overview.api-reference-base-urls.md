# Orchestration Cluster REST API — API reference — Base URLs

#### SaaS

In the Camunda Console, go to your cluster, and in the Cluster Details, find your **Region Id** and **Cluster Id**.

- For public connectivity (default), use this pattern as your `${BASE_URL}`: `https://${REGION_ID}.api.camunda.io/${CLUSTER_ID}/v2/`

- For secure connectivity (AWS PrivateLink), use the private base URL shown in Console. For the Orchestration Cluster REST API, the pattern is:

  `${BASE_URL} = https://${CLUSTER_ID}.${REGION_ID}.privateconnectivity.camunda.io/api/v2/`

  For example: `https://b4102386-6818-43c6-a880-d21c968a883f.ork-1.privateconnectivity.camunda.io/api/v2/topology`

#### Self-Managed

Use the host and path defined for your [Zeebe Gateway](https://docs.camunda.io/docs/next/reference/glossary#zeebe-gateway). For Ingress and routing details, see the [configuration guide](https://docs.camunda.io/docs/next/self-managed/deployment/helm/configure/ingress/ingress-setup). If you're using the default setup, the `${BASE_URL}` is `http://localhost:8080/v2/`.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview
