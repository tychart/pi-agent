---
name: git-commit
description: Stages and commits all changed and new files, then pushes to GitHub. Use when the user says "git commit", "commit and push", or any variant asking to commit and push changes.
---

# Git Commit & Push

## Usage

When the user asks to commit and push:

1. Review the current conversation for context about what work was done.
2. Inspect the repo before committing:
   - Run `git status` to see what changed
   - Run a concise diff summary such as `git diff --stat` (and/or `git diff --cached --stat` if relevant)
   - If the conversation context is not enough to explain the changes, inspect the actual diff for the most important files so the commit message matches the code that changed
3. Stage all files: `git add -A`
4. Create an automatic commit message based on both:
   - the conversation context, and
   - the actual git changes (`git status`, diff summary, and key diffs when needed)
5. Format the commit message as:
   - a relatively short single-line subject that is helpful and descriptive
   - a slightly longer description/body that explains the main changes or intent
6. Prefer a message that is specific, concrete, and readable rather than generic.
   - Good subject examples: `Add validation for schedule imports`, `Fix broken sidebar navigation state`
   - Avoid vague subjects like `Update files` or `Misc changes`
7. If you cannot confidently infer a good commit message from the conversation and git changes, ask the user to confirm or edit the generated message before committing.
8. Commit using both the subject and description/body.
9. Push: `git push`

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

Report:
- the final commit subject
- the commit hash
- whether the push succeeded
