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

## Handling Rebase Conflicts

If `git push` fails because of diverged history, or if the user wants to rebase and there are conflicts:

1. Run `git pull --rebase` to attempt the rebase
2. If conflicts arise, **stop and use the `ask-for-clarification` extension extensively** — ask the user how they want to resolve each conflict (their version, the remote version, or a manual merge)
3. Do not guess conflict resolutions. Always clarify with the user before editing conflicting files
4. Once clarified, resolve the conflicts, `git add` the resolved files, and continue the rebase with `git rebase --continue`
5. If rebase is too painful or the user doesn't care about a linear history, ask if they'd prefer `git pull` (merge) instead

## Push Failures

If `git push` is rejected:
- Run `git pull --rebase`, resolve any conflicts via `ask-for-clarification`, then retry `git push`
- If the remote has changes you didn't expect, describe them to the user and ask if they want to keep both sets of changes

Report the commit hash and whether the push succeeded.
