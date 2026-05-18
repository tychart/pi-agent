---
name: git-commit
description: Stages and commits all changed and new files, then pushes to GitHub. Use when the user says "git commit", "commit and push", or any variant asking to commit and push changes.
---

# Git Commit & Push

## Usage

When the user asks to commit and push:

1. Run `git status` to see what changed
2. Stage all files: `git add -A`
3. Commit with a short, helpful message describing what changed
4. Push: `git push`

Report the commit hash and whether the push succeeded.
