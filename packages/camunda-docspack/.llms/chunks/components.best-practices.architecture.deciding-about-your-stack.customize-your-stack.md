# Deciding about your stack — Customize your stack

### Polyglot stacks

You can develop process solutions as described with Java above also in any other programming language, including JavaScript. Use the [existing language clients and SDKs](https://docs.camunda.io/docs/next/apis-tools/working-with-apis-tools) for doing this.

### Run Camunda 8 Self-Managed

Run Camunda 8 on your Kubernetes cluster. For local development, a [Docker Compose configuration is available](https://docs.camunda.io/docs/next/self-managed/deployment/docker/docker), though not for production use. Learn more in the [deployment docs](https://docs.camunda.io/docs/next/self-managed/deployment/helm/install/quick-install).

### Choose an LLM provider

If your processes hand steps to [AI agents](https://docs.camunda.io/docs/next/reference/glossary#ai-agent), the LLM provider becomes part of your stack decision. Weigh hosting, data sensitivity, and cost as described in [choosing the right LLM](https://docs.camunda.io/docs/next/components/agentic-orchestration/choose-right-model-agentic). On Camunda 8 SaaS, you can also start with [Camunda-provided LLM](https://docs.camunda.io/docs/next/components/agentic-orchestration/camunda-provided-llm) and run agents without setting up a provider account first.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/deciding-about-your-stack
