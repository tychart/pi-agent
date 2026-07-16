---
name: deepiri-git-submodules
description: Git submodule workflow — adding, cloning, updating, removing submodules, and Deepiri-specific submodule pointer updates. Use when handling Git submodules in any Deepiri repo.
---

# Deepiri Git Submodule Guide

A **submodule** keeps another Git repository inside a subdirectory. The submodule has its own history, separate from the parent repo.

## Core Concept

**The parent repo tracks a specific commit hash of the submodule, not a moving branch.**

- **Parent Repo:** Stores the submodule URL + a pointer to a specific commit (e.g., `a1b2c3d`)
- **Submodule:** A full, independent Git repo sitting inside a folder

## `.gitmodules` File

When you create a submodule, Git creates `.gitmodules` in the root:

```ini
[submodule "lib/my-library"]
    path = lib/my-library
    url = https://github.com/username/my-library.git
```

## Command Cheat Sheet

### Adding a Submodule

```bash
git submodule add <repository-url> <path/to/folder>
# Example: git submodule add https://github.com/foo/bar.git libs/bar
```

### Cloning a Repo with Submodules

**Best way (one step):**
```bash
git clone --recurse-submodules <repository-url>
```

**If you already cloned without it:**
```bash
git submodule update --init --recursive
```

**Get specific submodules if the full clone fails:**
```bash
git submodule update --init <submodule_path_1> <submodule_path_2>
```

### Updating Submodules

**Sync to what the team is using** (match the commit in the parent repo):
```bash
git submodule update --init --recursive
```

**Get the absolute latest code** (fetch newest from submodule's remote branch):
```bash
git submodule update --remote --merge
```

### Removing a Submodule

```bash
git rm <path/to/submodule>
# Removes the folder and entry from .gitmodules
```

## Common Pitfalls

### "Detached HEAD" State

When you `cd` into a submodule, you're usually in a **Detached HEAD** state.

- **Why:** The parent repo points to a commit, not a branch.
- **The Fix:** Check out a branch before making changes:
  ```bash
  cd path/to/submodule
  git checkout main
  # ... make changes ...
  ```

### Forgetting to Push the Submodule

If you make changes inside a submodule and commit them in the parent repo, **you must push the submodule first**. If you push the parent but not the submodule, teammates will get an error saying the referenced commit does not exist.

---

## Deepiri Submodule Workflow

### Rule: Work in the submodule repo first

Any code changes start in the submodule repo where the change actually happens. Then you stage, commit, and PR the submodule **pointers** in the parent repo.

### PR Workflow for Submodules

1. Make changes **inside the submodule repo**
2. Stage, commit, and push inside that submodule repo
3. Open a **Pull Request in the submodule repo** first
4. Only after the submodule PR is ready/merged, update the parent repo (`deepiri-platform`)

### Even if no files change in the parent repo

Submodules are **pointers** in the parent repo. Whenever a submodule updates (even if parent files haven't changed), you still need to:

1. Stage the updated submodule pointer
2. Commit it
3. Make a PR in the parent repo (`deepiri-platform`)

### Why this matters

Git submodules work by storing a **specific commit pointer** in the parent repo. Updating a submodule's code changes the pointer. The parent repo needs that pointer updated so everyone else gets the new submodule commit. If you skip this, other team members stay on the old submodule commit and your changes won't appear.

### TL;DR

1. Make changes → **submodule repo** → PR
2. Update parent repo (`deepiri-platform`) → stage submodule pointer → PR
3. **Always** update the parent repo with the submodule pointer, even if no other files changed
