---
description: Audit, remediate, or revalidate a legacy Java repo/module for env-validation, SLF4J modernization, and Splunk ECS logging
argument-hint: "<mode> <parent-branch> <target-scope> [parent-build-file]"
---

Use a new child branch off `$2` to bring `$3` into compliance with the three skills `env-validation`, `slf4j-modernizer`, and `splunk-ecs-layout`.

The operating mode is `$1`.

## Mode contract

Valid modes:

- `remediate`
  - perform audit
  - produce a scoped plan
  - confirm the plan with the user before broad changes
  - implement approved changes
  - verify
- `revalidate`
  - audit the current state only
  - verify whether the target is now compliant after prior manual or external fixes
  - do not make broad new changes unless the user explicitly approves follow-up remediation
  - if small obvious fixes are tempting, report them first instead of silently applying them

If the supplied mode is unclear, stop and ask for clarification before proceeding.

## Scope to resolve

Interpret the arguments as:

- `MODE = $1`
- `PARENT_BRANCH = $2`
- `TARGET_SCOPE = $3`
- `PARENT_BUILD_FILE = ${4:-auto-detect the nearest shared parent/build file}`

`TARGET_SCOPE` may be:
- a whole repo, or
- one project/module within a multi-project repo

If the repo has multiple projects, keep scope limited to `TARGET_SCOPE` unless you discover a true parent/shared issue that cannot be solved locally. If that happens, stop and call it out explicitly instead of silently widening scope.

Also identify:
- `PRIMARY_BUILD_FILE`
  - usually `TARGET_SCOPE/pom.xml` for a module
  - or repo-root `pom.xml` for a single-project repo
- the main runtime logging/config files for `TARGET_SCOPE`

Ask for clarification before proceeding if any of these are ambiguous.

## Branching / starting point

- Start from branch: `PARENT_BRANCH`
- Create a new child branch for this work if `MODE=remediate`
  - example: `${2}-${3}-logging-upgrade`
  - convert the target scope into a safe branch slug
- If `MODE=revalidate`, stay on the current target branch unless the user asks otherwise
- Work only in the chosen child branch unless you discover a true parent/shared issue that cannot be solved in `TARGET_SCOPE`
- Do not change `PARENT_BRANCH` directly unless the user explicitly approves parent/shared follow-up work

## Important PRS/Waystar context to verify, not assume blindly

This repo family often has prior modernization work. Reuse it where applicable, but verify the current target state before changing anything.

### 1. Shared logging-resource packaging pattern
If the repo already uses the newer shared logging-resource pattern, preserve it:

- shared Log4j2 / Splunk resources should come from:
  - `${project.build.directory}/generated-resources/log4j2-shared`
- not from unpacking into `src/main/resources`
- if the target produces assembly/distribution zips, they should package generated:
  - `EcsLayout.json`
  - `log4j2Resources/**`
  back into `src/main/resources` paths inside the final distribution when runtime config expects those paths
- verify current assembly/resource wiring before changing anything

### 2. Shared `PRSProperties` env-placeholder support
If you adopt `${env:NAME}` or `${env:NAME:-default}` inside legacy property files, verify the target is actually consuming a `PRSCommonComponents` version that supports env-aware `PRSProperties` resolution.

Verify the resolved version, not just the checked-in property declaration.

### 3. Common PRS logging shape
Many PRS-family modules have some combination of:

- a module-owned top-level `src/main/resources/log4j2.xml`
- shared XInclude-based Log4j2 fragment usage
- historically commented-out Splunk appender include/ref in tracked `log4j2.xml`
- legacy `PRSProperties` usage in `Component.properties` and/or `service.properties`
- deploy scripts / assembly descriptors that may lag behind the preferred env-driven runtime model

Treat these as hypotheses to inspect, not assumptions.

### 4. `.ai/` workflow
If the repo uses the `.ai/` workflow:

- read relevant files under `.ai/memory/` before significant changes
- treat `.ai/AGENTS.md` as the live status board
- update `.ai/AGENTS.md`, `.ai/memory/*`, and `.ai/plans/*` as work progresses
- if `.ai/` is absent, skip this requirement rather than inventing it

## Skills to evaluate and apply

Use these three skills as the compliance target:

- `/home/tychart/.pi/skills-waystar/env-validation/SKILL.md`
- `/home/tychart/.pi/skills-waystar/slf4j-modernizer/SKILL.md`
- `/home/tychart/.pi/skills-waystar/splunk-ecs-layout/SKILL.md`

Read the relevant skill files directly before auditing or implementing.

## Initial audit orchestration

Prefer subagents for the initial audit. If subagents are unavailable, perform the same audit directly and explicitly note that fallback.

### Preferred audit pattern
Run three read-only audits in parallel:
- one reviewer for `env-validation`
- one reviewer for `slf4j-modernizer`
- one reviewer for `splunk-ecs-layout`

Each audit should:
- read the relevant skill file
- inspect `TARGET_SCOPE`
- inspect `PARENT_BUILD_FILE`
- inspect relevant `.ai/memory` and `.ai/plans` context if present
- produce:
  1. what currently passes
  2. what gaps remain
  3. exact file evidence
  4. whether `TARGET_SCOPE` is compliant overall for that skill

Then synthesize the three audit results into one target-specific result.

## Working style / scope rules

- Ask for clarification before broad or irreversible changes.
- Prefer `TARGET_SCOPE`-local fixes.
- Do not silently broaden into sibling modules/projects.
- Preserve existing appenders, logger levels, additivity, console/file logging, and runtime behavior unless a change is clearly required by the skills.
- Keep tests local-only; do not make tests depend on Splunk infrastructure.
- Prefer SLF4J in ordinary caller code.
- Keep `log4j-1.2-api` only if it is still justified by external/runtime dependencies.
- Do not invent repo-local env-validation classes if shared `PRSCommonComponents` support can be used.
- Do not reintroduce the old unpack-to-`src/main/resources` logging-resource pattern.
- Distinguish:
  - target-local compliance work
  - parent/shared build-system gaps
  - deployment-script/export follow-through

## What I want you to do

### Phase 1: Audit
Determine whether `TARGET_SCOPE` is currently compliant with:

- `env-validation`
- `slf4j-modernizer`
- `splunk-ecs-layout`

Pay special attention to whichever of these exist in the target:

- `PRIMARY_BUILD_FILE`
- `TARGET_SCOPE/src/main/resources/log4j2.xml`
- `TARGET_SCOPE/src/main/resources/Component.properties`
- `TARGET_SCOPE/src/main/resources/service.properties`
- Spring XML startup/config files
- Java startup/bootstrap entrypoints
- deploy scripts / assembly descriptors
- test logging resources
- any remaining direct `org.apache.log4j` or JUL usage
- whether Splunk include/ref is still commented out
- whether env validation is wired into actual startup paths
- whether env-backed `PRSProperties` changes rely on shared `PRSCommonComponents` support
- whether distribution packaging correctly carries generated shared logging resources

For single-project repos without these exact file names, inspect the equivalent logging/config/build/startup files.

### Phase 2: Plan
If `MODE=remediate`, produce a concise remediation plan for `TARGET_SCOPE` only.

The plan should clearly separate:

- items already satisfied
- target-local changes needed
- optional improvements
- anything that would require parent/shared-repo follow-up
- anything that would require deployment/operator follow-up outside the target scope

Before applying broad changes, confirm the plan with the user.

If `MODE=revalidate`, do not produce a broad new implementation plan unless the audit shows fresh gaps that still need remediation.

### Phase 3: Apply
Only if:
- `MODE=remediate`, and
- the user approves the plan

Implement the needed `TARGET_SCOPE` changes.

Likely categories include, if the audit shows they are needed:

- SLF4J modernization cleanup
- shared env-validation wiring
- selected env-backed `PRSProperties` placeholders in `Component.properties` / `service.properties`
- `{target}.env.example` or equivalent operator env example
- top-level `log4j2.xml` Splunk enablement using shared fragments
- env-backed Splunk/service/project properties in `log4j2.xml`
- local-only test logging config
- assembly/resource packaging follow-through
- dependency/provider cleanup for SLF4J + Log4j2 alignment
- replacing direct backend test/runtime operations with shared `LoggingBackendSupport` where appropriate

If `MODE=revalidate`, do not apply broad code changes unless the user explicitly converts the run into remediation mode.

### Phase 4: Verify
Run the narrowest practical verification that proves the current state:

- XML well-formedness checks
- JSON validity if applicable
- targeted Maven validation for `TARGET_SCOPE`
- dependency/provider checks for logging
- confirm generated shared resources land in `target/classes` and final distribution outputs when applicable
- confirm test logging remains local-only
- if env/property changes are present, watch for literal `${env:...}` leakage and verify they resolve correctly under the actual resolved shared `PRSCommonComponents` version

If full tests are environment-coupled, distinguish:

- true regressions
- existing environment-dependent failures
- operational caveats

## PRS-family lessons to carry forward

Apply these patterns wherever they fit the current target:

1. If you adopt `${env:NAME:-default}` in legacy property files, verify the target is actually consuming a compatible `PRSCommonComponents` artifact/version, not a stale older one.
2. If tests start failing with literal `${env:...}` strings in URIs or config lookups, suspect artifact/version mismatch first.
3. For Splunk compliance in this repo family, prefer:
   - target-owned top-level `log4j2.xml`
   - shared generated `EcsLayout.json`
   - shared generated `log4j2Resources/**`
   - not repo-local tracked copies of those shared resources
4. If the current `log4j2.xml` has commented-out Splunk refs/includes, treat that as a likely target-local gap to evaluate carefully.
5. The checked-in deploy/runtime model may lag behind ideal env-driven startup; distinguish:
   - app/build-side compliance
   - deployment-script/export follow-through
6. If subagents are unavailable, still preserve the same audit discipline:
   - per-skill findings
   - file evidence
   - scoped result
   - explicit approval before broad edits

## Deliverables

At the end, provide:

1. The mode that was run:
   - `remediate`
   - `revalidate`

2. A per-skill status for `TARGET_SCOPE`:
   - compliant
   - partially compliant
   - not compliant

3. A short summary of what you changed
   - or, if `MODE=revalidate`, what was verified and whether previous fixes hold

4. A short summary of what still remains, if anything

5. Exact file list changed
   - if no files changed, say so explicitly

6. Verification results run

7. Any residual risks or deployment caveats

8. Updated `.ai/AGENTS.md`, relevant `.ai/memory/*`, and a new `.ai/plans/*` artifact documenting the work, if the repo uses the `.ai/` workflow

