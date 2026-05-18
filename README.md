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

# 2. Clone config into ~/.pi, preserving local ignored files
tmpdir="$(mktemp -d)"
git clone git@github.com:tychart/pi-agent "$tmpdir/pi-agent"

mkdir -p ~/.pi
rsync -a "$tmpdir/pi-agent/" ~/.pi/

rm -rf "$tmpdir"

# 3. Install configured packages
cd ~/.pi
pi update --extensions

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
pi update --extensions
```

## What's gitignored

- `agent/auth.json` — API keys (machine-specific)
- `agent/sessions/` — conversation history (per-machine, changes frequently)
- `agent/bin/` — precompiled binaries (platform-specific)
- `agent/node_modules/` — installed deps
- `agent/extensions/**/*.js` — compiled output

## Notes

- `auth.json` must be created manually on each machine after setup
- **Sessions are local per-machine** — they mesh only if the cwd path matches exactly across machines. Windows vs. Linux paths create separate folders.
- This repo is private, and credentials `auth.json` is included in `.gitignore`
