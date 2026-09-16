# Doing a proper POC — Defining a scope relevant to your business — Planning the technical environment

Make the necessary technological choices. Typically, POCs _run on Camunda 8 SaaS_ unless your goal is to validate that Camunda 8 runs in your Kubernetes environment in a self-managed fashion. A simple test account is often sufficient, unless your goal is to do load or performance tests, for which you need bigger clusters. Reach out to us in such cases. If your POC includes [AI agents](https://docs.camunda.io/docs/next/reference/glossary#ai-agent), SaaS also gives you [Camunda-provided LLM](https://docs.camunda.io/docs/next/components/agentic-orchestration/camunda-provided-llm), so you can run them within a provided budget instead of setting up an LLM provider account first.

To access _third party systems_ during your POC, set up proper test systems for those and verify that they are usable.

Prepare a location in a _version control system_ where you can develop your POC. Having a shared repository with history does make sense also (or especially) in a 2-day POC! Collaboration is simplified if the Camunda consultant can also access that repository. It may be worth just creating a repository with weaker access limitations for the POC.

If your organization cannot easily set up a repository for the POC, or access for externals is impossible, you can create a cloud repository. We typically recommend [GitHub](https://github.com/); a free account is sufficient. It gives you a Git repository and you can invite all necessary people for the POC. Afterwards, you can delete that repository.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/management/doing-a-proper-poc
