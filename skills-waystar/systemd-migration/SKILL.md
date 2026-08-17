---
name: systemd-migration
description: Migrate legacy Linux service supervision to modern systemd on RHEL-style hosts. Audit first, clarify decisions with the user, then plan and implement reusable unit/env packaging for both large multi-JVM repos and simple single-service repos.
---

# Systemd Migration Skill

## Purpose

Use this skill to migrate legacy service supervision to modern `systemd`, especially in repos that currently rely on one or more of the following:

- `init.d` / SysV scripts
- `chkconfig`
- ad hoc shell wrappers using `nohup`, `&`, `ps`, `grep`, `kill -9`, or pidfiles
- deployment zips that ship startup scripts next to the application
- per-host config rewrites instead of cleaner host-installed service definitions

This skill is specifically about **Linux/RHEL systemd migration**, not general deployment modernization.

The skill is designed to work across:

- large multi-module repos with many JVMs or cooperating processes
- monorepos where one module acts as the suite-level deploy owner
- smaller single-project repos with only one main service
- legacy enterprise repos where packaging familiarity matters as much as architectural cleanliness

## Core stance

### Default service model

Default to:

- **one `systemd` service per long-running JVM/process**
- **one grouping target/unit for the suite when there are multiple managed processes**
- **separate OS-managed dependencies** for shared infrastructure such as ActiveMQ

Examples:

- multi-JVM repo → one service per JVM plus one `*.target`
- single JVM repo → one `*.service`; add a target only if it materially helps operators or groups additional services

Before implementing, **explicitly re-check this model with the user via clarification** instead of assuming it is always correct.

### Clarification-first rule

This skill must **ask for clarification before planning and before implementation**.

At minimum, clarify:

1. whether the task is audit-only, plan-only, or implement
2. whether the repo runs one process or a cooperating suite of processes
3. whether operators want one top-level command for the whole suite
4. whether shared dependencies like ActiveMQ should stay separate
5. whether packaging familiarity should preserve the repo's current deploy layout
6. whether host-installed env files containing secrets are acceptable

If uncertainty remains after the first clarification round, ask narrower follow-up questions.
Do not silently choose the service model, file placement, or packaging behavior when the repo is ambiguous.

## What this skill should usually recommend

### For similar legacy Java repos

When a repo resembles older PRS-style packaging and deployment patterns, prefer this default shape:

- one service per JVM
- one suite-level target when there are multiple services
- host-installed env files under `/etc/<app>/` or a similarly clear service directory
- **tracked** unit/env-example files under each owning module's `src/main/resources/deploy/`
- suite-level target and parent env example under the suite/orchestration module
- install runtime unit files into `/etc/systemd/system/`
- install runtime env files into `/etc/<app>/`

### Why module-local `src/main/resources/deploy/` is the default for similar legacy repos

For repos that already package deploy assets from `src/main/resources/deploy/`, prefer keeping the new `systemd` assets there when practical.

This is the default for similar repos because it:

- preserves team familiarity
- keeps ownership clear: component files stay with the component module
- allows existing Maven/TFS zip packaging flows to ship the new assets naturally
- lets one suite-owner module carry the suite-level target and top-level docs
- avoids introducing an entirely new repo-wide deploy layout when the old one is already organizationally important

### But do not force this layout blindly

If the repo does **not** already have a meaningful module-local deploy/package pattern, stop and clarify before defaulting to `src/main/resources/deploy/`.

For newer or simpler repos, a top-level `deploy/` or `packaging/systemd/` layout may still be better.

## Migration workflow

## Phase 1: audit the repo before suggesting files

Inspect the repo's current runtime/deploy shape.

Look for:

- `init.d` or SysV scripts
- startup wrappers
- deploy directories under `src/main/resources/deploy/`
- Maven/Gradle packaging behavior
- assembly descriptors, resource filtering, release-copy scripts
- process lists in scripts
- external dependencies such as ActiveMQ, RabbitMQ, databases, Hazelcast, Tomcat, sidecars, etc.
- service-specific env example files or existing host config conventions
- stop logic based on HTTP admin endpoints, JMS admin messages, pidfiles, or custom wrappers

Questions to answer during audit:

1. How many long-running processes are actually managed together?
2. Which module, if any, already acts as the suite deployment owner?
3. Are the processes truly independent, ordered, or grouped for operator convenience only?
4. Is there an existing per-artifact env-example naming convention?
5. Will putting files under `src/main/resources` trigger Maven filtering or packaging side effects?
6. Is there already a stable deployed directory layout that the units should preserve?

For a large complicated repo, inspect module boundaries and existing deploy ownership before inventing a new structure.
For a single-project repo, keep the audit lighter but still check packaging and runtime paths.

## Phase 2: clarify and propose the service model

After the audit, summarize the detected shape and ask targeted follow-up questions.

### Preferred recommendation for multi-process suites

Recommend:

- one `.service` per JVM/process
- one `*.target` for top-level operations
- separate infrastructure dependencies like `activemq.service`

### Preferred recommendation for single-service repos

Recommend:

- one `.service` for the main process
- no target unless the user wants a top-level grouping abstraction or additional related services

### Anti-patterns to avoid by default

Do **not** default to:

- one giant wrapper `.service` that launches all children and backgrounds them
- `nohup` / `&` / shell-managed pid scraping
- `Type=forking` unless the application truly only exposes a forking wrapper and the user chooses to keep it
- repo-tracked secret values
- mixing deployment-time env example files with live secret-bearing env files in git

## Phase 3: choose tracked file placement

### Default placement for similar legacy repos

If the repo already has meaningful module-local deploy folders, default to:

- suite-level target, main service, and parent env example under the suite/orchestration module's `src/main/resources/deploy/`
- component-specific service and env example under each component module's `src/main/resources/deploy/`

Example pattern:

```text
suite-module/src/main/resources/deploy/
  app.target
  app-main.service
  APP.env.example
  README-systemd.md

component-a/src/main/resources/deploy/
  component-a.service
  ComponentA.env.example

component-b/src/main/resources/deploy/
  component-b.service
  ComponentB.env.example
```

### Naming conventions

Prefer:

- unit files named for the operational service slug, e.g. `prs-edi.service`
- env example files named with the artifact/service identifier, e.g. `PRSEdiComponent.env.example`
- one top-level target named after the suite, e.g. `prs.target`

If the repo already has a clear naming convention, follow it instead of inventing a new one.

## Phase 4: design the unit files

### Standard service defaults

For ordinary long-running Java processes, prefer:

```ini
[Service]
Type=simple
User=<service-user>
Group=<service-group>
WorkingDirectory=<stable-install-dir>
EnvironmentFile=-/etc/<app>/<ArtifactId>.env
ExecStart=/usr/bin/java ... -jar <jar>
Restart=on-failure
RestartSec=10
TimeoutStartSec=120
TimeoutStopSec=120
KillMode=control-group
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
StandardOutput=journal
StandardError=inherit
```

### Use absolute executable paths

`ExecStart=` must use a real executable path such as `/usr/bin/java`.
Do not rely on `${JAVA_HOME}/bin/java` as the executable token in `ExecStart=`.
Environment variables can still shape JVM flags, but the executable path should be explicit.

### Preserve stable deployed paths where practical

When the repo already deploys jars under stable paths like `/usr/<App>/<Component>/`, prefer preserving those paths in the first migration.
Do not require a runtime layout rewrite unless the user asks for deeper cleanup.

### Separate infrastructure dependencies

If the application depends on a local ActiveMQ instance or similar OS-managed dependency, prefer:

```ini
[Unit]
Wants=network-online.target
Requires=activemq.service
After=network-online.target activemq.service
```

If the host uses a different broker unit name, clarify and adapt.

### Grouping target for suites

For multi-process suites, create a `*.target` that:

- groups the services for operator-facing start/stop/restart
- depends on the shared infrastructure dependency if appropriate
- lists the component services in `Wants=`

Example:

```ini
[Unit]
Description=Example application suite
Requires=activemq.service
After=network-online.target activemq.service
Wants=network-online.target app-a.service app-b.service app-main.service

[Install]
WantedBy=multi-user.target
```

Each member service should normally include:

```ini
PartOf=example.target
```

### Graceful shutdown

If the legacy repo already has a real graceful stop path, preserve it first.
Examples:

- HTTP admin shutdown endpoints
- JMS admin/shutdown messages
- repo-provided stop commands

Only fall back to pure signal-based stop behavior when that is the real intended runtime behavior.

## Phase 5: env-example design

Prefer host-installed env files such as:

- `/etc/<app>/<ArtifactId>.env`

Keep **examples** in repo as:

- `<ArtifactId>.env.example`

This skill assumes the team may accept secrets in the host-installed env files as an improvement over git-tracked secrets.
That is acceptable if explicitly chosen, but still keep the real values out of git.

Each example file should typically include:

- `JAVA_HOME` if the repo expects it
- optional `JAVA_DEBUG_OPTS`
- optional `JAVA_COMMON_OPTS`
- optional `JAVA_COMPONENT_OPTS`
- dependency endpoints such as `AMQ_ADMIN_URL` if the stop path needs them
- service-specific application environment variables

Do not fill env-example files with fake secrets unless they are clearly placeholders.

## Phase 6: packaging and filtering safeguards

### Always inspect packaging if files go under resources

If unit files or env examples are placed under `src/main/resources`, **always inspect and update packaging as needed**.

This is mandatory behavior for this skill.

### Why this matters

Maven resource filtering can corrupt:

- `${VAR}` syntax in unit files
- `.env.example` placeholder syntax
- `systemd` command lines and property expressions

### Required packaging behavior

When systemd/env example files live under filtered resources, update the build so they are:

1. excluded from the filtered resource/file set
2. added back through an unfiltered resource/file set

Typical candidates to treat unfiltered:

- `deploy/*.service`
- `deploy/*.target`
- `deploy/*.env.example`
- `deploy/README-systemd.md`

Inspect the actual repo packaging mechanism before editing:

- Maven assembly descriptors
- `<resources>` blocks
- `maven-resources-plugin`
- release-copy scripts
- Gradle resource tasks

Do not guess; verify how the repo currently ships deploy assets.

## Phase 7: documentation and install guidance

Add or update a migration/readme document describing:

- where the tracked files live in repo
- where they should be installed on the host
- recommended permissions
- the top-level operator commands
- any dependency-unit naming assumptions such as `activemq.service`
- any packaging caveats

For similar legacy repos using module-local `deploy/`, a suite-level `README-systemd.md` under the owner module is a good default.

## Phase 8: verification

Always verify the generated units as much as possible.

### Expected checks

- `systemd-analyze verify <unit files>`
- sanity-check absolute `ExecStart=` executables
- sanity-check `ConditionPathExists=` targets if used
- inspect whether referenced dependency units exist on the current host

### Important nuance

If `systemd-analyze verify` reports that a dependency like `activemq.service` is missing on the dev machine, that is not necessarily a unit-syntax failure.
Report it clearly as an environment-specific dependency resolution issue.

## Repo-shape-specific guidance

## A. Large multi-module / multi-JVM repos

Examples of signals:

- multiple deployable sibling modules
- one suite owner module with shared deploy assets
- one legacy script launching multiple JVMs together

Preferred approach:

1. identify the suite owner module
2. place suite-level target/main-service/docs there
3. place component services and env examples with their owning modules
4. preserve stable install paths first
5. inspect all affected packaging descriptors, not just one module
6. clarify whether any service ordering is real or just legacy habit

Do not flatten a complicated repo into one new top-level deploy layout without user confirmation.

## B. Single-project repos

Examples of signals:

- one main jar
- one startup script
- one env example
- no sibling deploy modules

Preferred approach:

1. ask whether a target is even needed
2. usually create one clean `.service`
3. keep one `<ArtifactId>.env.example`
4. place tracked files where the repo already expects deploy assets to live
5. still inspect packaging if the files go under `src/main/resources`

## Stop-and-confirm checkpoints

Pause and confirm with the user before widening scope when you move from one stage to another:

- after audit, before recommending the service model
- after proposing tracked file placement
- before editing packaging/assembly descriptors
- before changing runtime stop behavior
- before touching deploy/install scripts outside the new unit/env artifacts

## What to report back

When done, report:

1. the chosen service model
2. the tracked file locations in repo
3. the host install locations
4. any packaging/filtering changes made
5. what verification succeeded
6. any remaining dependency or rollout caveats

## Preferred default summary

For similar legacy Java repos, the preferred default is:

- audit first
- clarify before planning and before implementing
- one `systemd` service per JVM
- one suite-level target for multi-process suites
- separate OS-managed shared dependencies like ActiveMQ
- keep tracked files in module-local `src/main/resources/deploy/` when that matches the repo's existing packaging/deploy ownership model
- use `<ArtifactId>.env.example` files in repo and host-installed `/etc/<app>/<ArtifactId>.env` files at runtime
- always inspect and fix packaging/filtering when placing these files under resources

