# pi-config

My [pi coding agent](https://pi.dev) configuration. Extensions, skills, prompt templates, settings, and models — synced across machines.

## What's in here

| Path | Purpose |
|------|---------|
| `agent/settings.json` | Global pi defaults (provider, model, packages) |
| `agent/models.json` | Custom provider definitions (Ollama, LiteLLM) |
| `agent/extensions/` | Custom TypeScript extensions |
| `agent/AGENTS.md` | Global agent instructions (if added) |
| `agent/skills/` | Custom skills (if added) |
| `agent/prompts/` | Prompt templates (if added) |
| `agent/themes/` | Custom themes (if added) |

## Setup (first time)

```bash
# 1. Install pi
npm install -g @earendil-works/pi-coding-agent

# 2. Clone this repo
git clone git@github.com:tychart/pi ~/.pi
cd ~/.pi

# 3. Install configured packages
PI_CODING_AGENT_DIR=~/.pi pi update --extensions

# 4. Add credentials
# Copy a template or create ~/.pi/agent/auth.json with your keys
# (see the auth.json.example once added)

# 5. (Optional) Install utility binaries
# rg and fd are gitignored — install via your package manager:
#   Ubuntu: sudo apt install ripgrep fd-find
#   Fedora: sudo dnf install ripgrep fd-find
#   macOS:  brew install ripgrep fd
```

## Updating

```bash
cd ~/.pi && git pull && PI_CODING_AGENT_DIR=~/.pi pi update --extensions
```

## What's gitignored

- `agent/auth.json` — API keys (machine-specific)
- `agent/sessions/` — conversation history (per-machine)
- `agent/bin/` — precompiled binaries (platform-specific)
- `agent/node_modules/` — installed deps
- `agent/extensions/**/*.js` — compiled output

## Notes

- `auth.json` must be created manually on each machine after setup
- Sessions are local per-machine — they mesh only if the cwd path matches exactly
- This repo is private — credentials and conversation history stay local
