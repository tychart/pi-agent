---
name: deepiri-git-pr
description: Deepiri organization Git PR workflow — create feature branches, open PRs to dev, tag support-team, update Plaky. Use when working on any Deepiri repo, creating or reviewing a PR, or following the Deepiri branching workflow.
---

# Deepiri Git PR Skill

Follow the Deepiri Git PR workflow. See [references/branch-pipeline.md](references/branch-pipeline.md) for the full diagram and [references/role-workflows.md](references/role-workflows.md) for role-specific steps.

## Quick Reference

| Role | Action | Target Branch |
|------|--------|---------------|
| Developer | Push feature → PR → dev | `dev` |
| Team Lead | Review → merge dev → main | `main` |
| Product Manager | Merge dev → main (fallback) | `main` |
| QA | Test **only** `dev` branch | `dev` |

## Developer: Creating a PR

When a developer needs to create a PR, follow these steps:

### 1. Ensure branch is up to date

```bash
git fetch
git pull origin dev
```

### 2. Commit changes

```bash
git add .
git commit -m "feat: <short summary>"
# or fix:, refactor:, chore:, docs: etc.
```

### 3. Push branch

```bash
git push -u origin <your-branch-name>
```

### 4. Open PR

- **From**: your feature branch → **dev**
- **Merged by**: Team Leads only

**PR must:**
- Match the Plaky task name in the title
- Include the PR template (see below)
- Tag `@Team-Deepiri/support-team`
- List related PRs in comments
- Include Plaky Task name in the description
- Be tagged with applicable GitHub topics

### 5. Update Plaky

After pushing and creating the PR, set the Plaky task status to:

```
Needs QA
```

❗ **Never** move to "Done" — that's for production releases only.

## PR Template

When creating a PR, include this structure:

```markdown
## Description
Briefly explain what this PR does and why. Include:
- The issue/feature/bug this PR relates to
- The component or system affected
- The purpose or goal of the change

## Changes
- New or updated functions/services/components
- Refactoring or structural improvements
- Dependency or configuration changes
- Other significant updates

## Related PRs
- [Repo/PR#1](url) — brief description
- [Repo/PR#2](url) — brief description

## Plaky Task
[name of the Plaky task]

## Topics
- Feature / Bug / Refactor / Chore / Documentation / AI / DevOps / QA/Maintenance / NEEDS HELP
```

**Always tag**: `@Team-Deepiri/support-team`

## GitHub Topics

Tag PRs with one or more of these topics:
- `Feature`
- `Bug`
- `Refactor`
- `Chore`
- `Documentation`
- `AI`
- `DevOps`
- `QA/Maintenance`
- `NEEDS HELP`

## Branch Naming

Personal branches follow one of these patterns:
```
firstname_lastname-dev
firstname_lastname/feature/<plaky_feature_name>
firstname_lastname/bug/<bug_fix_name>
```

## Plaky Status Flow

```
PR Created → Needs QA
QA Rejects → QA Rejected
QA Approves → QA Approved
Merged to main → Done
```

## Key Rules

1. **Only push to your personal feature branch**
2. **PRs always target `dev`** — never `main` directly
3. **Tag support team on every PR**
4. **Update Plaky immediately** after pushing
5. **Don't merge your own PR** unless you're a Team Lead / PM
6. **QA tests `dev` only**, not feature branches
7. **"Done" status = production release only**

See [references/branch-pipeline.md](references/branch-pipeline.md) for the full pipeline diagram and [references/role-workflows.md](references/role-workflows.md) for Team Lead, Product Manager, and QA specifics.
