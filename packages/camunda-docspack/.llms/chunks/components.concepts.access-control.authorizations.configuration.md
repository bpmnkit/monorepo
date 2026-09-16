# Orchestration Cluster authorization — Configuration

### SaaS configuration

In Camunda 8 SaaS, authorizations can be enabled or disabled per cluster. This setting can be changed by:

- Organization admins
- Organization owners

### Self-Managed configuration

In Self-Managed deployments, you can enable the authorization system using:

  
### yaml

```yaml
camunda.security.authorizations.enabled: true
```
  
  
### env

```yaml
CAMUNDA_SECURITY_AUTHORIZATIONS_ENABLED=true
```
  
  
### helm

```yaml
orchestration.security.authorizations.enabled=true
```
  

### Behavior when authorization is disabled

The shared authorization service skips resource-ID and property-based permission
checks for every resource type. These checks return an authorized result instead
of denying access.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
