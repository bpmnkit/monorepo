# Local development with element templates and Camunda 8 Run — Provisioning a custom connector runtime

You can add a custom connector runtime to Camunda 8 Run by copying the `.jar` file containing all connector dependencies into the `custom_connectors` directory in the root folder of your Camunda 8 Run setup.

This guide uses a generic [connector template](https://github.com/camunda/connector-template-outbound) as a reference.

1. Clone the repository and run the following command to generate a deployable file:

   ```bash
   mvn clean verify package
   ```

This command creates a file named `target/connector-template-0.1.0-SNAPSHOT-with-dependencies.jar`.

2. Copy the `.jar` file into the `custom_connectors` directory.
3. Start Camunda 8 Run with Docker Compose. For example, from the Docker Compose directory in your Camunda 8 Run setup, run:

```bash
docker compose up -d
```

4. Your connector is ready to execute jobs when a process references it.

If you use a different [connector runtime environment](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/connector-sdk#runtime-environments), ensure that secrets are also exposed to that runtime.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/local-development-with-element-templates
