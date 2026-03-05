# casen

CLI for the [Camunda 8 Orchestration Cluster REST API (v2)](https://docs.camunda.io/docs/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview/).

Commands are auto-generated from the official OpenAPI specs — every resource and operation stays in sync automatically. See [DOCUMENTATION.md](./DOCUMENTATION.md) for the full command reference.

## Features

- **All API resources** — process instances, jobs, user tasks, decisions, users, groups, tenants, and more
- **Multiple profiles** — store named connection configs and switch between them instantly
- **Three output formats** — human-readable table (default), `--output json`, `--output yaml`
- **Shell completions** — bash, zsh, and fish
- **Zero dependencies** — no runtime requirements beyond Node.js

## Installation

```bash
# From the monorepo root
pnpm build

# Then link globally (optional)
npm link ./apps/cli
```

## Quick start

**1. Create a profile**

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

**Import from a Camunda Cloud credentials file**

When you create a client in Camunda Cloud, you can download a credentials file containing `export KEY='VALUE'` declarations. Import it directly:

```bash
casen profile import prod ./camunda-credentials.sh

# or pipe via stdin
cat camunda-credentials.sh | casen profile import prod -
```

The file must contain at least:

| Variable | Fallback |
|----------|----------|
| `ZEEBE_REST_ADDRESS` | _(required)_ |
| `CAMUNDA_CLIENT_ID` | `ZEEBE_CLIENT_ID` |
| `CAMUNDA_CLIENT_SECRET` | `ZEEBE_CLIENT_SECRET` |
| `CAMUNDA_OAUTH_URL` | `ZEEBE_AUTHORIZATION_SERVER_URL` |

**2. Run a command**

```bash
casen process-instance list --filter '{"state":"ACTIVE"}'
casen user-task list --filter '{"assignee":"alice"}'
casen process-instance create --data '{"processDefinitionId":"order-process"}'
```

## Profiles

Profiles store connection configuration in the OS config directory:

| Platform | Location |
|----------|----------|
| Linux | `$XDG_CONFIG_HOME/casen/config.json` or `~/.config/casen/config.json` |
| macOS | `~/Library/Application Support/casen/config.json` |
| Windows | `%APPDATA%\casen\config.json` |

Use `--profile <name>` on any command to temporarily override the active profile.

## Output formats

Results can be printed as a table (default), JSON, or YAML via `--output json` / `--output yaml`. Colors and table formatting are automatically disabled when stdout is not a TTY or when `NO_COLOR` is set.

## Shell completions

```bash
# zsh
mkdir -p ~/.zfunc && casen completion zsh > ~/.zfunc/_casen
# add to ~/.zshrc: fpath=(~/.zfunc $fpath) && autoload -Uz compinit && compinit

# bash
casen completion bash >> ~/.bash_completion

# fish
casen completion fish > ~/.config/fish/completions/casen.fish
```

## Help

```bash
casen --help                       # Global help
casen <resource> --help            # Resource-level help
casen <resource> <command> --help  # Command-level help
```

For all available resources and commands see [DOCUMENTATION.md](./DOCUMENTATION.md).
