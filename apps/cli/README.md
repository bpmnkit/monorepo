# casen

CLI for the [Camunda 8 Orchestration Cluster REST API (v2)](https://docs.camunda.io/docs/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview/).

Auto-generated from the official OpenAPI specs — every resource and operation stays in sync automatically.

## Features

- **All API resources** — process instances, jobs, user tasks, decisions, users, groups, tenants, and more
- **Multiple profiles** — store named connection configs and switch between them instantly
- **Three output formats** — human-readable table (default), `--output json`, `--output yaml`
- **Shell completions** — bash, zsh, and fish
- **Zero dependencies** — single binary, no runtime requirements beyond Node.js

## Installation

```bash
# From the monorepo root
pnpm build

# Then link globally (optional)
npm link ./apps/cli
```

## Quick start

### 1. Create a profile

```bash
# Bearer token (local / self-managed)
casen profile create local \
  --base-url http://localhost:8080/v2 \
  --auth-type bearer \
  --token my-token

# OAuth2 (Camunda SaaS)
casen profile create prod \
  --base-url https://<cluster-id>.camunda.io/v2 \
  --auth-type oauth2 \
  --client-id <client-id> \
  --client-secret <client-secret> \
  --token-url https://login.cloud.camunda.io/oauth/token
```

The first profile created becomes the active profile automatically.

### 2. Run a command

```bash
# List active process instances
casen process-instance list --filter '{"state":"ACTIVE"}'

# Get a specific process instance
casen process-instance get 2251799813685281

# Start a new process instance
casen process-instance create --data '{"processDefinitionId":"order-process","variables":{"orderId":"123"}}'

# Search user tasks assigned to you
casen user-task list --filter '{"assignee":"alice"}'

# Complete a user task
casen user-task complete 2251799813685200 --data '{"approved":true}'
```

## Profiles

Profiles store connection configuration (URL, auth credentials) in the OS config directory:

| Platform | Location |
|----------|----------|
| Linux | `$XDG_CONFIG_HOME/casen/config.json` or `~/.config/casen/config.json` |
| macOS | `~/Library/Application Support/casen/config.json` |
| Windows | `%APPDATA%\casen\config.json` |

```bash
casen profile list               # Show all profiles
casen profile show               # Show the active profile
casen profile use prod           # Switch active profile
casen profile delete local       # Delete a profile
```

Use `--profile <name>` on any command to temporarily override the active profile:

```bash
casen process-instance list --profile prod
```

## Output formats

```bash
casen process-instance get 2251799813685281              # table (default)
casen process-instance get 2251799813685281 --output json
casen process-instance get 2251799813685281 --output yaml
```

Pipe-friendly: colors and table formatting are automatically disabled when stdout is not a TTY, or when `NO_COLOR` is set.

## Shell completions

```bash
# zsh
mkdir -p ~/.zfunc
casen completion zsh > ~/.zfunc/_casen
# Add to ~/.zshrc if not already present:
#   fpath=(~/.zfunc $fpath)
#   autoload -Uz compinit && compinit

# bash
casen completion bash >> ~/.bash_completion

# fish
casen completion fish > ~/.config/fish/completions/casen.fish
```

## All resources

| Resource | Alias | Description |
|----------|-------|-------------|
| `process-instance` | `pi` | Process instances |
| `process-definition` | `pd` | Process definitions |
| `user-task` | `ut` | User tasks |
| `job` | | Service jobs |
| `incident` | | Incidents |
| `variable` | `var` | Variables |
| `decision-definition` | `dd` | Decision definitions |
| `decision-instance` | | Decision evaluation history |
| `message` | | Messages |
| `signal` | | Signals |
| `resource` | | Deployed resources (BPMN, DMN, forms) |
| `element-instance` | `element` | Element instances |
| `batch-operation` | `batch` | Batch operations |
| `user` | | Identity users |
| `group` | | Identity groups |
| `role` | | Identity roles |
| `tenant` | | Tenants |
| `authorization` | `auth` | Authorizations |
| `mapping-rule` | `mapping` | Mapping rules |
| `cluster` | | Topology and cluster info |
| `profile` | | Connection profiles |

## Global flags

| Flag | Short | Description |
|------|-------|-------------|
| `--profile <NAME>` | `-p` | Use a specific profile for this command |
| `--output <FORMAT>` | `-o` | Output format: `table` \| `json` \| `yaml` (default: `table`) |
| `--no-color` | | Disable colored output |
| `--debug` | | Print request details and stack traces on error |
| `--help` | `-h` | Show help |

## Examples

```bash
# Cluster health
casen cluster get-topology

# Deploy a process definition
casen resource create-deployment

# List jobs of a specific type
casen job list --filter '{"type":"send-email"}'

# Activate jobs for a worker
casen job activate --data '{"type":"send-email","worker":"worker-1","timeout":60000,"maxJobsToActivate":10}'

# Search decision instances
casen decision-instance list --filter '{"decisionDefinitionId":"loan-approval"}' --limit 50

# Create a user (identity)
casen user create --data '{"username":"alice","email":"alice@example.com","password":"secret"}'

# Assign a user to a group
casen group assign-user <group-id> <user-id>

# Get JSON output and pipe to jq
casen process-instance list --filter '{"state":"ACTIVE"}' --output json | jq '.[].processInstanceKey'
```

## Help

```bash
casen --help                          # Global help
casen <resource> --help               # Resource-level help
casen <resource> <command> --help     # Command-level help
```
