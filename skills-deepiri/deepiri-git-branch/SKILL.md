---
name: deepiri-git-branch
description: Deepiri Git branch conventions — naming, team-dev branches, PR flow from personal branches through team-dev to dev to main, role responsibilities. Use when working with Deepiri branch structure, creating branches, or following the branching workflow.
---

# Deepiri Git Branch Conventions

Branch naming, team dev branches, and the full PR flow through the repository.

## ⚠️ Golden Rule

**NEVER commit, push, or merge directly to `main`, `dev`, or any team-dev branch.** Always push to your personal or feature branch.

## Branch Naming

| Type | Pattern |
|------|---------|
| Personal dev | `firstname_lastname-dev` |
| Feature | `firstname_lastname/feature/<name>` |
| Bug fix | `firstname_lastname/bug/<name>` |
| Chore | `firstname_lastname/chore/<name>` |

## Creating a Branch

```bash
git pull origin main
git checkout -b <your-branch-name>
```

## Team Dev Branches (per repo)

Each team has its own team-dev branch (varies by repo):

```
frontend-team-dev
backend-team-dev
ai-team-dev
ml-team-dev
infrastructure-team-dev
qa-team-branch
```

## Full Branch Flow

```
Developer Work
└── firstname_lastname-dev
└── firstname_lastname/feature/<name>
└── firstname_lastname/bug/<name>
└── firstname_lastname/chore/<name>
    └── PR → team-dev (team lead merges)
        └── PR → dev (lead merges)
            └── QA tests dev
                └── PR → main (after QA approval)
```

## Detailed PR Flow

### 1. Personal Development Branches

Developers write code in their personal branches.

**Rules:**
- Never commit directly to team branches, `dev`, or `main`
- Always branch **from** the latest team dev branch or `dev` depending on what you're working on

**PR Target:** Personal Dev / Feature or Bug → Team Dev

### 2. Team Development Branches

Feature branches are merged into the appropriate team dev branch by the team lead.

**PR Target:** All team members' branches → team-dev-branch

The team lead approves, runs tests, and merges.

### 3. Organizational Dev Branch (Global Dev)

All team dev branches merge upward into `dev` — the integration branch where all teams' work comes together.

**PR Target:** team-dev-branch → `dev` (team lead handles)

### 4. QA Testing Stage

Once code lands in `dev`:

1. QA pulls the latest `dev`
2. Runs manual and automated tests
3. Files issues back into GitHub if problems are found
4. If approved, `dev` is cleared for release

**QA Results:**
- **Pass:** Merge into `main`
- **Fail:** Issues assigned back to engineers

### 5. Merge Into Main (Production)

**PR Target:** `dev` → `main`

**Who Merges:**
- Lead engineer
- Release manager
- Repo admin

**Requires:**
- Full QA approval
- All tests passing
- No open blockers

## Role Responsibilities

### Developer
- Regularly pull from your team dev branch
- Keep PRs small and focused
- Write clear commit messages
- Never skip code review

### Team Lead
- Enforce reviewer requirements
- Validate test coverage
- Ensure branches stay conflict-free
- Maintain clear communication with QA

### QA
- Test against the *dev* branch only
- Log issues with proper labels and reproducible steps
- Communicate blockers immediately

### App Manager
- Route QA reviewers to PRs
- Ensure PRs are responded to
- Ensure the Plaky component status matches the PRs

## Key Rules

1. **NEVER merge the branch yourself** unless given direct instructions
2. **Pull from main first** before creating your branch
3. **Keep synced** with your team-dev branch during development
4. **ONLY SUBMIT PRs to dev branch**
