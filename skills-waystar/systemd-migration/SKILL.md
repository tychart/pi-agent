---
name: systemd-migration
description: Migrate a legacy Java application or multi-JVM suite to a platform-owned Ansible, systemd, staged-release, and host-environment deployment model. Use before env validation, logging, Splunk, or other runtime-configuration migrations.
---

# Systemd Migration: Platform-Owned Ansible Model

## Purpose

Use this skill to move a legacy Linux Java deployment away from SysV/init.d scripts, `chkconfig`, shell-managed JVMs, in-place config rewrites, and application-repo-owned deployment artifacts into a durable platform deployment model:

```text
Application repository                 Platform / SRE Ansible repository
----------------------                 -------------------------------
source + Maven/Gradle artifacts   →    inventory + Vault-backed inputs
runtime config placeholders       →    env-file templates
rule/deploy helper source         →    systemd unit templates
component distribution ZIPs       →    Java/runtime and application roles
                                     staged release update / rollback flow
                                     host provisioning and service lifecycle
```

The target is not merely “put a legacy wrapper behind systemd.” The target is:

- one direct `systemd` service per long-running JVM;
- a suite target for a multi-JVM application when operators need one entry point;
- platform-owned systemd units, environment templates, inventory, and secrets;
- a versioned release tree with a stable `current` symlink;
- configuration rendered into a **staged release before cutover** when legacy consumers cannot read environment values natively;
- direct `java -jar` service launches, not a new shell wrapper at every start.

This skill is for RHEL-style hosts and Ansible-managed deployments. It should be run **before** the `env-validation`, `slf4j-modernizer`, and `splunk-ecs-layout` skills when adopting this platform model. Those later skills depend on knowing exactly how environment variables reach the JVM and where runtime configuration is materialized.

## What this skill owns—and does not own

This skill establishes the deployment/runtime contract. It may require coordinated changes in both repositories, but it does not replace application-specific work.

### Platform-owned responsibilities

The platform Ansible source of truth owns:

- a supplied application inventory, for example `prs_inventory/`, passed explicitly with `-i` on every invocation;
- encrypted secret inputs and non-secret environment/application/host inventory values;
- a Java runtime role, commonly named `java_runtime`;
- an application deployment role, commonly named `java_app`;
- `deploy-<app>.yml` and `config-<app>.yml` playbooks;
- profile-specific systemd unit and environment-file templates;
- host directories, users/groups, permissions, `systemd` daemon reloads, service enablement, release staging, and update orchestration;
- deployment validation and safe operational commands.

### Application-owned responsibilities

The application repository owns:

- buildable component artifacts and a repeatable command that collects the exact deployable ZIPs;
- application code and runtime resources;
- environment placeholders in the config files that need deployment-specific values;
- configuration-path compatibility needed by direct Java/systemd startup;
- safe rule-loader and other utility entrypoints;
- tests that protect application behavior;
- documentation that identifies the platform deployment contract without duplicating secrets, units, or live environment files.

### Explicit non-goals

Do **not**:

- keep the application repository’s old init.d wrapper as the target production path;
- copy live `.service`, `.target`, live `.env`, or secret-bearing files into application distributions “for convenience”;
- write plaintext secrets to Git, application examples, tickets, test output, agent memory, or chat;
- use a runtime shell wrapper merely to render legacy configuration on every service start;
- assume a source-tree property file is the deployed value after staged-release rendering;
- claim a service is migrated because a unit file exists without proving its real release, env, logging, and shutdown paths.

## Reference architecture

For a PRS-like suite, use this shape as the model to emulate. The names are examples, not required names.

```text
Ansible controller
├── deploy-prs.yml                     # mutating provision/release playbook
├── config-prs.yml                     # non-mutating inventory/env preflight
├── roles/
│   ├── java_runtime/                  # Java installation / runtime prerequisites
│   └── java_app/                      # application layout, assets, services, releases
└── prs_inventory/                     # supplied with -i for every execution
    ├── hosts/
    └── group_vars/
        ├── <app>.yml                  # app-wide scalar defaults
        ├── <app>_stg_config.yml       # environment-wide differences
        ├── <app>_prd_config.yml
        └── all/vault.yml              # encrypted/provisioned outside Git as required

Managed host
└── /opt/<org>/<app>/
    ├── current -> releases/<release-id>
    ├── releases/<release-id>/
    │   ├── MainService/
    │   ├── BatchService/
    │   └── ...
    ├── env/
    │   ├── <APP>-common.env
    │   ├── MainService.env
    │   ├── BatchService.env
    │   └── update-script.env          # root-only deployment helper config when needed
    ├── runtime/
    ├── logs/
    └── scripts/

/etc/systemd/system/
├── <app>.target
├── <app>-main.service
├── <app>-batch.service
└── ...
```

The PRS example has seven long-running JVMs: main, batch, EDI, merge, route-manager, Selenium, and Selenium2. Its target unit groups them while a local broker remains a separate OS-managed dependency. A new application may have one service, or a different suite composition; do not copy the service count blindly.

## Required clarification checkpoints

This is a clarification-first skill. Ask before planning and again before implementation. Continue asking if a choice is unclear.

At minimum, establish:

1. **Scope:** audit-only, plan-only, platform implementation, application preparation, or both repositories?
2. **Process model:** how many JVMs/long-running processes exist, and which are genuine services versus one-shot utilities?
3. **Grouping:** does the operator need one `<app>.target` for the suite?
4. **Dependencies:** which dependencies are OS-managed (`activemq.service`, databases, sidecars, etc.), and which must remain separate?
5. **Ownership:** will the platform/SRE Ansible implementation be the source of truth for units, env templates, inventory, and release scripts? This is the default for new work.
6. **Release layout:** what are the host application root, release directory, stable `current` symlink, component directory names, service account, and Java path?
7. **Configuration:** which config consumers natively support env/system property lookup and which require staged-release rendering?
8. **Secrets:** where do Vault/secret-manager values live, who may run the playbooks, and what files/processes can read generated env files?
9. **Cutover:** what existing drain, VIP/pulse, firewall, health-check, broker, rules-upload, and rollback behavior must be preserved?
10. **Rollout safety:** which inventory leaf targets are permitted for staging, local simulation, and production? What approval and host-identity controls exist?

Do not assume that a legacy `deploy/` directory is still the desired owner of units and env examples. Under this model, it normally is not.

# Phase 1 — Audit both sides before proposing changes

## 1. Audit the application repository

Inspect:

- legacy init.d/SysV scripts, `chkconfig`, `service`, `nohup`, `&`, pid scraping, and `kill` behavior;
- all long-running `main(...)` entrypoints and their component/artifact names;
- component POMs/build files, assembly descriptors, and output ZIP shape;
- `src/main/resources` and any external `config/` paths used at runtime;
- Spring XML, Hibernate XML, Hazelcast XML, raw properties readers, and custom property loaders;
- logging configuration paths and appender dependencies;
- deployment helper scripts, especially rules/migration/load utilities;
- old `prsdeploy.properties`-style rewrite maps and other post-build mutations;
- shutdown hooks, ActiveMQ/JMS/HTTP admin operations, readiness probes, and health endpoints;
- all files changed between the migration branch and `master`.

Use a command such as:

```bash
git log --oneline master..HEAD
git diff --name-status master...HEAD
git diff --stat master...HEAD
```

Classify every meaningful changed file into one of these buckets:

| Bucket | Typical examples | Why it matters |
|---|---|---|
| Build/package | POMs, assembly descriptors, release ZIP script | must ship exactly what the platform updater expects |
| Runtime config | `.properties`, Spring XML, Hibernate/Hazelcast XML | may need staged rendering before Java starts |
| Logging | `log4j2.xml`, shared fragments | must read service env at Log4j initialization |
| Service entrypoint | `main`, JVM args, relative paths | direct `systemd` startup exposes path assumptions |
| Utility/deploy | rule loaders, rules deploy, migrations | should not inherit fragile service-only dependencies |
| Legacy-only | SysV wrappers and copied deploy assets | document as retired/non-authoritative; do not keep extending them |

## 2. Audit the supplied platform Ansible implementation

Do not assume the application repository contains the operational truth. Inspect the supplied platform source that the SRE team will use.

Required inspection targets:

```text
playbooks/deploy-<app>.yml
playbooks/config-<app>.yml
roles/java_runtime/
roles/java_app/
roles/java_app/templates/apps/<profile>/systemd/
roles/java_app/templates/apps/<profile>/env/
roles/java_app/files/apps/<profile>/scripts/
roles/java_app/files/scripts/
<app>_inventory/
```

Establish and record:

- the exact `-i <app>_inventory` invocation model;
- inventory hierarchy and leaf target groups;
- where Vault-backed values are provisioned and which variables are safe to expose;
- precedence rules for app-wide, environment-wide, host-specific, and CLI values;
- role input names and defaults;
- host directory layout, owner/group, and permissions;
- how assets are discovered/installed;
- which unit templates are installed and where;
- environment-file order for each service;
- the direct `ExecStart` command and working directory;
- target/dependency relationships;
- release download or local-package staging behavior;
- staged config rendering point, readiness criteria, rollback trigger, and cleanup policy;
- treatment of utility scripts and rule deployment;
- local/staging/prod safety controls and known limitations.

## 3. Identify discrepancies before changing anything

Call out these common blockers explicitly:

- a systemd unit uses a persistent config path but the release ZIP only has an in-release config path;
- a Java main starts before required config is rendered;
- an env template is rendered but no unit loads it;
- a unit loads an env file after a conflicting file that overrides critical values;
- the application expects raw `${ENV}` but a consumer only understands a different placeholder grammar;
- the systemd service can run but the deploy updater cannot find rule helpers after the `current` symlink changes;
- a one-shot utility inherits a production Splunk/logging config without the service environment;
- source artifacts are packaged but the platform expects a different component directory or JAR name;
- an old wrapper is still being called by release automation despite the new unit model;
- production inventory or remote authorization has unresolved safety limitations.

# Phase 2 — Choose and document the target model

## Preferred default: platform-owned Ansible and direct systemd

For new migrations, the default is:

1. platform Ansible owns systemd units, env templates, inventory, secrets, host files, and release orchestration;
2. a `java_runtime` role installs/pins the required Java runtime;
3. a `java_app` role creates the application user/group and stable host layout, renders env files, installs units/scripts, enables services, and invokes release updates;
4. each long-running JVM is a direct `Type=simple` systemd service;
5. a target groups services only when useful to operators;
6. releases are staged under `releases/<id>` and cut over by updating `current` only after preparation succeeds;
7. application config is rendered into the staged release, not mutated in place after startup;
8. units use direct Java execution rather than `nohup`, `&`, or a process-manager wrapper.

Repo-owned `.service`, `.target`, or `.env.example` files are a **legacy fallback only**. Use them only if the platform team explicitly cannot own the assets yet. If temporarily needed, isolate them from resource filtering and remove them once platform ownership is established.

## Systemd unit contract

A long-running JVM unit should normally resemble:

```ini
[Unit]
Description=<Application Component>
Wants=network-online.target
After=network-online.target <dependency>.service
Requires=<dependency>.service
PartOf=<app>.target
ConditionPathExists=/opt/<org>/<app>/current/<Component>/<Component>.jar

[Service]
Type=simple
User=<service-user>
Group=<service-group>
WorkingDirectory=/opt/<org>/<app>/current/<Component>
EnvironmentFile=-/opt/<org>/<app>/env/<APP>-common.env
EnvironmentFile=-/opt/<org>/<app>/env/<Component>.env
ExecStart=/usr/bin/java \
  -Xmx${JAVA_HEAP} \
  $JAVA_DEBUG_OPTS \
  $JAVA_COMMON_OPTS \
  $JAVA_COMPONENT_OPTS \
  -Dlog4j.configurationFile=file:src/main/resources/log4j2.xml \
  -jar /opt/<org>/<app>/current/<Component>/<Component>.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=10
TimeoutStartSec=120
TimeoutStopSec=120
KillMode=control-group
KillSignal=SIGTERM
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
StandardOutput=journal
StandardError=inherit

[Install]
WantedBy=<app>.target
```

Adapt the dependency, paths, heap, runtime flags, Java path, and readiness/shutdown values to the actual application. Do not copy a PRS setting simply because it appears in a reference unit.

### Suite target

For a multi-JVM suite, a target should group members and model shared dependencies:

```ini
[Unit]
Description=<Application> suite
Requires=<dependency>.service
After=network-online.target <dependency>.service
Wants=network-online.target <app>-main.service <app>-batch.service
AllowIsolate=false

[Install]
WantedBy=multi-user.target
```

Use explicit dependencies only when they are real. A target is not a substitute for a correct per-service dependency graph.

## Environment file contract

Use a common file plus component-specific files:

```text
/opt/<org>/<app>/env/<APP>-common.env
/opt/<org>/<app>/env/<Component>.env
```

The common file should hold genuine shared values such as:

```text
JAVA_HOME=...
JAVA_DEBUG_OPTS=...
JAVA_COMMON_OPTS=...
SPLUNK_URL=...
SPLUNK_TOKEN=...
SPLUNK_INDEX=...
HOST_NAME=...
```

Component files should hold only component-specific values such as heap-independent JVM options, endpoint overrides, DB credentials, queue settings, or behavioral toggles.

Rules:

- order is meaningful: load common first, component-specific second so the latter can override intentionally;
- render live files from Ansible templates; do not copy them from an application ZIP;
- use root ownership and an application-readable group only when the JVM needs the values;
- use restrictive modes (normally directory `0750`, standard runtime env file `0640`); use a root-only deployment-helper env file (`0600`) when it contains release credentials;
- keep Vault material encrypted/provisioned outside normal Git tracking and never print rendered files;
- explicitly identify optional values and defaults. Do not let missing critical values silently become blank strings.

# Phase 3 — Make application artifacts compatible with the model

## 1. Build one coherent release payload

The application repository should provide a repeatable root command that:

1. builds every deployable component;
2. produces each component distribution ZIP;
3. collects exactly those ZIPs under a versioned output directory; and
4. does not require manual copying from many module `target/` directories.

For PRS, this is represented by a root component-ZIP build script that collects seven `*-dist.zip` artifacts. A new application should provide equivalent reproducibility, even if it has one artifact.

Verify the final ZIP contents, especially:

- `<Component>.jar` is where the unit expects it;
- `src/main/resources/log4j2.xml` exists if the unit points there;
- generated shared resources are included when externalized Log4j includes require them;
- deployment helper scripts and rule descriptors are packaged if the platform updater invokes them;
- release artifacts do not include live env files or platform-owned units.

## 2. Convert deployment-sensitive config to explicit placeholders

Legacy services often contain host values in:

- `Component.properties`;
- `service.properties` and `rulemanager.properties`;
- Spring XML;
- Hibernate XML;
- Hazelcast XML;
- logging XML;
- rules deployment descriptors.

First determine **who parses each file**. Do not apply one placeholder syntax blindly.

| Consumer | Typical safe approach |
|---|---|
| Spring `PropertyPlaceholderConfigurer` | raw `${ENV_NAME}` / system properties if the effective Spring stack supports them |
| Shared custom `Properties` implementation | that implementation’s documented syntax, often `${ENV_NAME}` or `${ENV_NAME:-default}` |
| Hibernate/Hazelcast/raw third-party XML reader | staged-release rendering unless native substitution is proven |
| Log4j2 | `${env:NAME:-default}` at Log4j initialization, supplied by systemd `EnvironmentFile=` |
| shell utility | source/read a deliberately selected env file, or pass explicit arguments; do not assume it inherits systemd service env |

When the application contains mixed consumers, use a generic **staged-release renderer**:

1. unpack a new release into a versioned staging directory;
2. load the explicitly selected ordered env files for each target;
3. render only the listed config targets;
4. fail on missing env files, missing target files, or unresolved required placeholders;
5. optionally validate XML after rendering;
6. only then flip `current`;
7. start direct Java units against the already-rendered release.

Do not render configuration on every service start. Rendering must complete before any Java class can read the new release configuration.

### Renderer manifest rules

Keep an explicit target list near the platform updater/profile, not hidden auto-discovery. A useful conceptual mapping is:

```text
<APP>-common.env,<Main>.env | Main/src/main/resources/Component.properties
<APP>-common.env,<Main>.env | Main/src/main/resources/hibernate.cfg.xml
<APP>-common.env,<Route>.env | Route/src/main/resources/rulemanager.properties
```

Requirements:

- env files are listed by relative name under the host env directory;
- load them left-to-right; later files override earlier values;
- target paths are relative to the staged release root;
- the mapping must be reviewed whenever new config files, components, or placeholder syntaxes are introduced;
- escape syntax and unresolved-placeholder behavior must be documented and tested;
- rendered files are release artifacts, never manually maintained host state.

## 3. Treat logging as a deployment contract

Do not run the later logging/Splunk skills until this systemd/env contract exists.

Once it exists:

- every long-running service should load the shared env file before Java starts;
- each module’s `log4j2.xml` can safely use Log4j2 `${env:...}` lookups;
- shared Splunk appender fragments/layouts can be packaged as build resources while their endpoint/token/index remain platform env inputs;
- validate whether missing telemetry configuration is critical (fail before normal logging) or optional (disable/detach the appender before it can throw);
- do not assume a Spring startup validator protects Log4j initialization—the appender often initializes first;
- distinguish the HEC event envelope host/source/index from fields inside an ECS JSON layout;
- keep test loggers local-only.

## 4. Isolate one-shot utilities

Rule loaders, migration tools, release helpers, and administrative CLIs are not long-running services. They frequently execute outside a unit’s environment and must not fail because telemetry is unavailable.

For PRS-like rule deployment:

- ship a dedicated `log4j2-ruleloader.xml` that is console/file-only;
- make the wrapper explicitly use that config;
- use paths derived from the active release/current link rather than hard-coded old application roots;
- forward arguments exactly;
- test the wrapper with a fake Java executable or equivalent focused test;
- ensure the platform updater invokes the intended release helper at the intended point in cutover.

Keep normal service `log4j2.xml` separate from utility logging.

# Phase 4 — Implement the platform Ansible contract

## 1. Inventory design

Use a dedicated supplied inventory, for example:

```bash
ansible-playbook -i prs_inventory config-prs.yml -e in_target_host=prs_stg
ansible-playbook -i prs_inventory deploy-prs.yml -e in_target_host=prs_stg -e in_build_number=<build>
```

Use names appropriate to the real application. The PRS names are examples for teams emulating its model.

Inventory principles:

- define explicit application leaf target groups such as `<app>_stg`, `<app>_prd`, and `<app>_local_stg`;
- keep environment/configuration groups separate from deployment target groups;
- use app-wide, environment-wide, and inline host-specific scalar variables with documented precedence;
- prefer leaf scalar names over nested dictionaries so a host override cannot accidentally erase sibling values;
- reserve CLI `-e` variables for documented operational inputs such as target/build, not durable application configuration;
- store secret source values in the approved Vault/secret mechanism;
- reject `TODO` and `PLACEHOLDER` values during preflight;
- never paste `ansible-inventory --host` output without reviewing it for decrypted secrets.

A config-only playbook should reuse the same validation/pre-render logic as deployment but perform no host mutation. It is the first operator command before a rollout.

## 2. Role responsibilities

### `java_runtime`

The Java runtime role should install or otherwise ensure the required JVM/runtime packages. The deploy playbook supplies the selected Java home/bin contract to the application role.

### `java_app`

The application role should:

1. validate role inputs and profile-specific inventory;
2. create the service user/group and host directories;
3. install runtime prerequisites and optional firewall baseline when approved;
4. discover/render application env templates;
5. install platform-owned systemd unit templates into `/etc/systemd/system/`;
6. install shared/profile updater and rendering scripts with restrictive modes;
7. reload systemd, enable services/target, and start the target as appropriate;
8. stage or download a requested release;
9. invoke the profile release updater;
10. stop on the first failed host for a rolling deployment unless a different approved strategy exists.

The role should fail early if required profile assets—units, env templates, or scripts—are absent. A new app migration must add all three deliberately.

## 3. Release update lifecycle

The updater should be a platform-owned profile script. Its exact details vary, but its lifecycle should be explicit:

```text
validate operator/deploy inputs
→ obtain or stage component distribution ZIPs
→ extract into releases/<new-id>
→ render staged configuration from persistent host env files
→ validate staged release
→ begin maintenance/drain steps only after preparation succeeds
→ stop suite target
→ atomically update current symlink
→ run required release-scoped rules/migrations at the documented point
→ restart shared dependencies when required
→ start suite target
→ verify readiness
→ restore traffic/pulse when safe
→ roll back current to previous release on post-cutover failure
→ retain/prune releases according to policy
```

For HA systems, preserve real operational behavior deliberately:

- stop a pulse/VIP process before blocking traffic if that is the established contract;
- wait for peer failover when required;
- block traffic and wait for in-flight work only after all preparatory work succeeds;
- define safe interrupt behavior: before stop/cutover, restore pulse/traffic; after cutover, leave traffic blocked until an operator makes a safe decision;
- do not mask a failed release with an automatic “success” restart;
- verify more than `systemctl is-active` when the application exposes reliable functional checks.

## 4. Rules and migrations

Determine whether a helper describes versioned release content or persistent host configuration.

- Keep versioned rule descriptors and release-bound scripts under the release tree.
- Keep host credentials/config in persistent env files or secure platform configuration.
- Make updater invocation paths use `current` or the newly staged release intentionally; do not rely on a stale legacy absolute path.
- Decide and document whether rule deployment occurs before or after the `current` switch, and what rollback means if it fails.

# Phase 5 — Validate before declaring the migration complete

## Application/build checks

- build every deployable component from a clean checkout;
- run the root collection script or equivalent;
- inspect every component ZIP and the assembled staged release tree;
- verify expected JAR, config, shared logging resources, rule helpers, and file permissions;
- run focused tests for changed startup paths, config readers, and helper argument forwarding;
- verify stale platform units/env files are not accidentally packaged from the application repository.

## Ansible checks

Run these with the supplied application inventory and redact output as needed:

```bash
ansible-playbook -i <app>_inventory --syntax-check config-<app>.yml
ansible-playbook -i <app>_inventory --syntax-check deploy-<app>.yml
ansible-lint config-<app>.yml deploy-<app>.yml roles/java_app roles/java_runtime
ansible-playbook -i <app>_inventory config-<app>.yml -e in_target_host=<app>_local_stg
```

Then validate a non-production target before production. The config playbook must render/preflight every runtime env template without exposing contents.

## Host/systemd checks

On an approved non-production host:

```bash
systemd-analyze verify /etc/systemd/system/<app>.target /etc/systemd/system/<app>-*.service
systemctl cat <app>.target
systemctl cat <app>-main.service
systemctl status <app>.target
journalctl -u <app>-main.service -b
```

Also verify:

- every unit loads the expected common and component env files in the intended order;
- the service account can read required env/config files but unrelated users cannot;
- `WorkingDirectory`, `ConditionPathExists`, JAR paths, and config paths resolve through `current`;
- systemd starts no shell background children and owns the JVM cgroup;
- restart, stop, and target-level operations behave as designed;
- interrupt/rollback behavior is tested in a non-production environment;
- renderer failures happen before the `current` symlink changes;
- absence of telemetry env has the explicitly chosen safe behavior;
- rule/migration utilities use isolated local logging and do not need HEC/network telemetry.

A missing dependency unit on a developer machine may be environment-specific; distinguish it from syntax failure. A unit that validates syntactically but cannot load its release/env/config is not a successful migration.

# Phase 6 — Document for maintainers new to the system

The final documentation must explain all of the following in plain language:

1. **Source of truth:** platform Ansible owns units, env templates, inventory, and deployment lifecycle; the application repo owns build artifacts and runtime compatibility.
2. **Why legacy scripts are retired:** they are historical references only and must not receive new deployment features.
3. **How to prepare a release:** exact root build/collection command and expected artifact directory.
4. **How to validate safely:** `config-<app>.yml` first, with `-i <app>_inventory` and an explicit leaf target.
5. **How to deploy:** `deploy-<app>.yml`, target selection, approved build input, serial/approval expectations, and rollback location.
6. **Inventory model:** app/environment/host precedence, Vault boundary, leaf scalar variable convention, and no secret disclosure.
7. **Env model:** common versus component env files, permissions, ordering, and which values are rendered versus read natively at JVM startup.
8. **Release model:** `releases/<id>`, `current`, staged rendering, verification, rollback, and cleanup.
9. **Service model:** one JVM per unit, suite target, shared dependencies, direct Java execution, logs/journal, and standard commands.
10. **Utility model:** rule loaders/migrations are not services and use separate local logging.
11. **Follow-on skill order:** after this deployment contract works, run environment validation, logging modernization, and Splunk/ECS work against the proven systemd/env runtime model.
12. **Known limits:** any remaining approval, host-authenticity, functional-readiness, production-inventory, or release-credential limitations must be stated plainly rather than hidden.

# New application migration cookbook

Use this checklist when moving another Java app to the same system.

1. Inventory every service, utility, dependency, config file, and legacy script.
2. Decide one-service vs suite-target model with the application owner and platform team.
3. Define the stable host root, service identity, release directory, current link, service account, Java version, and backup/rollback policy.
4. Add a profile to the platform `java_app` role:
   - systemd template(s),
   - common/component env templates,
   - release updater,
   - staged renderer mapping if required,
   - validation contract.
5. Add application inventory groups, scalar variables, Vault references, and a supplied `<app>_inventory` structure.
6. Add `config-<app>.yml` that runs the same validation/pre-render contract as deploy without mutating hosts.
7. Add `deploy-<app>.yml` that runs `java_runtime`, then `java_app`, accepts only approved leaf targets, and uses a safe rolling strategy.
8. Update the application build to produce exactly the component distributions the updater expects.
9. Change only config files that need deployment values; use native env lookup where proven and staged rendering where not.
10. Make utilities independent from service-only telemetry/config assumptions.
11. Verify local/staging installation, release cutover, restart, rollback, and failure paths.
12. Mark old application-repo deployment wrappers explicitly legacy; remove them only after the platform path is accepted and recoverable.
13. Only then run the env-validation, SLF4J/logging, and Splunk skills against the final runtime model.

# Output expected from an agent using this skill

Before implementation, provide:

- a two-repository audit summary;
- service/dependency inventory;
- chosen ownership, directory, env, unit, release, and renderer model;
- a file-by-file implementation plan;
- operator-facing validation/deployment commands using the supplied inventory;
- explicit remaining risks and approval gates.

After implementation, provide:

- changed application and platform files, separated by repository;
- unit/env/release lifecycle evidence;
- build, syntax, lint, and host verification commands/results;
- proof that staged rendering occurs before cutover;
- proof that legacy wrappers are not the active deployment path;
- rollback and residual-risk notes;
- documentation locations for future maintainers.
