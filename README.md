# pi-config

My [pi coding agent](https://pi.dev) configuration. Extensions, skills, prompt templates, settings, and models — synced across machines.

## What's in here

| Path | Purpose |
|------|---------|
| `agent/settings.json` | Global pi defaults (provider, model, packages) |
| `agent/settings.json.example` | Template — copy to `settings.json` and adjust machine-specific values |
| `agent/models.json` | Custom provider definitions (Ollama, LiteLLM) |
| `agent/extensions/` | Custom TypeScript extensions |
| `agent/skills/` | Custom skills |
| `agent/prompts/` | Prompt templates |
| `agent/agents/` | Custom agent definitions |
| `.pi-subagents/` | Subagent runtime artifacts (gitignored) |

### Installed packages

| Package | Purpose |
|---------|---------|
| `npm:@plannotator/pi-extension` | Pi extension (install/upgrade) |
| `npm:pi-web-access` | Web search, fetch content, get search content |
| `npm:pi-provider-litellm` | LiteLLM provider integration |
| `npm:pi-subagents` | Subagent delegation (chains, parallel, async) |

### Custom extensions

| File | Purpose |
|------|---------|
| `agent/extensions/ask-for-clarification.ts` | Ask clarifying questions before acting |
| `agent/extensions/context-diff.ts` | Context diff generation |
| `agent/extensions/tps.ts` | TPS provider |

## Bootstrap (idempotent)

Run this anywhere to reinstall everything to match the config exactly:

```bash
pi install npm:@plannotator/pi-extension \
&& pi install npm:pi-web-access \
&& pi install npm:pi-provider-litellm \
&& pi install npm:pi-subagents \
&& pi update --extensions
```

This command is idempotent — safe to run repeatedly. If a package is already installed at the right version it skips; if not (or if updated in npm), it installs/updates it. Then `pi update --extensions` re-syncs any custom TypeScript extensions.

## Setup (first time)

```bash
# 1. Install pi
npm install -g @earendil-works/pi-coding-agent

# 2. Clone config into ~/.pi, preserving local ignored files
tmpdir="$(mktemp -d)"
git clone git@github.com:tychart/pi-agent "$tmpdir/pi-agent"

mkdir -p ~/.pi
rsync -a "$tmpdir/pi-agent/" ~/.pi/

rm -rf "$tmpdir"

# 3. Bootstrap packages and extensions
cd ~/.pi
pi install npm:@plannotator/pi-extension \
&& pi install npm:pi-web-access \
&& pi install npm:pi-provider-litellm \
&& pi install npm:pi-subagents \
&& pi update --extensions

# 4. Add credentials if needed
cp -n ~/.pi/agent/auth.json.example ~/.pi/agent/auth.json
$EDITOR ~/.pi/agent/auth.json

# 5. (Optional) Install utility binaries
# rg and fd are gitignored — install via your package manager:
#   Ubuntu: sudo apt install ripgrep fd-find
#   Fedora: sudo dnf install ripgrep fd-find
#   macOS:  brew install ripgrep fd
```

## Updating

```bash
cd ~/.pi
git pull
pi install npm:@plannotator/pi-extension \
&& pi install npm:pi-web-access \
&& pi install npm:pi-provider-litellm \
&& pi install npm:pi-subagents \
&& pi update --extensions
```

## What's gitignored

- `agent/auth.json` — API keys (machine-specific)
- `agent/settings.json` — machine-specific settings (use `settings.json.example` as template)
- `agent/run-history.jsonl` — machine-specific subagent run history
- `agent/sessions/` — conversation history (per-machine, changes frequently)
- `agent/bin/` — precompiled binaries (platform-specific)
- `agent/node_modules/` — installed deps
- `agent/extensions/**/*.js` — compiled output
- `.pi-subagents/` — subagent runtime artifacts

## Notes

- `auth.json` must be created manually on each machine after setup
- `settings.json` must be created from `settings.json.example` on each machine (machine-specific values: provider, defaultModel, subagents.defaultModel)
- **Sessions are local per-machine** — they mesh only if the cwd path matches exactly across machines. Windows vs. Linux paths create separate folders.
- This repo is private, and credentials `auth.json` is included in `.gitignore`
