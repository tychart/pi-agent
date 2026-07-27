---
name: env-validation
description: Adopt the shared PRSCommonComponents environment validation system in consuming services. Use when a repo needs startup validation of env vars, warning vs critical tiers, Spring XML or Spring Boot wiring, or migration away from copied EnvironmentConfigurationValidator.java files.
---

# Shared Environment Validation Adoption

## Purpose

Use the shared environment validation implementation from `PCS_PRSCommonComponents` instead of generating a repo-local validator.

This skill helps an agent:

- add or verify the `PRSCommonComponents` dependency
- wire the shared validator into service startup
- declare service-specific warning and critical environment variables
- preserve the deployment model where runtime startup exports env vars and Java reads `System.getenv()`
- selectively env-back `PRSProperties`-consumed settings that should not live as shared committed defaults
- migrate repos away from copied `EnvironmentConfigurationValidator.java` implementations

## Source of Truth

The implementation to consume lives in this repo:

- `/home/tychart/projects/PCS_PRSCommonComponents`

Primary classes:

- `src/main/java/com/recondotech/prs/config/env/EnvironmentConfigurationValidator.java`
- `src/main/java/com/recondotech/prs/config/env/EnvironmentValidationRequest.java`
- `src/main/java/com/recondotech/prs/config/env/EnvironmentValidationResult.java`
- `src/main/java/com/recondotech/prs/config/env/EnvironmentValidationMessages.java`
- `src/main/java/com/recondotech/prs/config/env/EnvironmentVariableRequirement.java`
- `src/main/java/com/recondotech/prs/config/env/EnvironmentVariableSeverity.java`
- `src/main/java/com/recondotech/prs/config/env/SystemEnvironmentProvider.java`
- `src/main/java/com/recondotech/prs/config/env/spring/EnvironmentValidationStartupHook.java`
- `src/main/java/com/recondotech/prs/config/env/spring/EnvironmentValidationRequestFactoryBean.java`
- `src/main/java/com/recondotech/prs/config/env/spring/EnvironmentValidationConfiguration.java`
- `src/main/java/com/recondotech/prs/utils/PRSProperties.java`

If there is any uncertainty about the intended API or behavior, read those files from the PRSCommonComponents repo before editing the consuming repo.

## Core Rule

**Do not generate a new local `EnvironmentConfigurationValidator.java` when the consuming repo can use the shared implementation from `PRSCommonComponents`.**

Prefer importing and wiring:

- `com.recondotech.prs.config.env.*`
- `com.recondotech.prs.config.env.spring.*`

## Shared Behavior To Preserve

The shared implementation already provides these semantics:

- default runtime source is `System.getenv()`
- blank strings count as missing
- warning variables write to `System.err`, also log through SLF4J, and do not block startup
- critical variables write to `System.err`, also log through SLF4J, and throw `IllegalStateException`
- messages include service name and variable names only
- no secret values are logged
- tests can inject a `Map<String,String>` into `EnvironmentConfigurationValidator`

Do not reimplement these semantics locally unless the user explicitly asks for a fork.

## Shared `PRSProperties` Runtime Option

`PRSCommonComponents` now also provides a shared runtime path for selected legacy property-file values that are consumed through `PRSProperties`.

Supported placeholder forms in committed property files include:

- `${env:NAME}`
- `${env:NAME:-default}`
- `${sys:NAME}`
- `${sys:NAME:-default}`

Current shared behavior:

- placeholder resolution happens at `PRSProperties` load/reload time
- there is no per-`getProperty(...)` placeholder parsing cost
- blank env/sys values count as missing for fallback purposes
- unresolved placeholders without a value/default remain literal strings
- `setProperty(...)` remains literal in the current shared contract

Use this capability selectively. It is a good fit for values that are:

- credentials or secrets
- instance-specific identifiers
- per-environment or per-node endpoints/settings that should not be shared blindly across cluster members

It is usually **not** the right move to env-back every value in `Component.properties` or related property files. Stable, non-sensitive defaults that belong in source control should usually remain committed properties.

## When To Use This Skill

Use this skill when a repo needs any of the following:

- env-backed startup readiness validation
- warning vs critical env-var handling
- migration away from copied validator source
- legacy Spring XML wiring for env validation
- Spring Boot wiring for early env validation
- service-specific declaration of env requirements while keeping shared validator behavior centralized
- selective env-backing of `PRSProperties`-consumed sensitive or deployment-specific values

## Adoption Posture

By default, treat env-validation adoption as a **phased, low-risk cleanup**, not a mandate to force every legacy config surface onto env vars immediately.

Preferred default posture:

1. take the easy env-backed wins now
   - shared env validation
   - `<artifactId>.env.example`
   - env-backed logging/observability config
   - Spring-managed config that already supports placeholders cleanly
   - selective `${env:...}` / `${sys:...}` adoption for `PRSProperties`-consumed sensitive or deployment-specific values
2. avoid bespoke repo-local bootstrap/adaptation code unless the user explicitly wants that now
3. defer harder legacy config families until there is either:
   - shared `PRSCommonComponents` support, or
   - an approved deeper refactor

### Typical “easy now” vs “defer for later” split

Usually safe to do now:

- shared validator wiring
- warning/critical env classification
- operator-facing env example files
- Spring bean placeholder updates where Spring is the final consumer
- selective `PRSProperties` placeholder adoption for credentials, secrets, and other node-/environment-specific values

Usually better to defer unless the user asks for deeper work:

- blanket migration of all committed property-file values to env-backed form
- stubborn legacy XML consumers that do not cleanly resolve env vars
- migrations that would require many scattered direct `System.getenv()` reads
- repo-local one-off env bootstrap classes that would be hard to standardize later

## Phase 1: Inspect the Consuming Repo

Before making changes, inspect:

1. build system and dependency style (`pom.xml`, parent POMs, dependency management)
2. runtime style:
   - legacy Spring XML
   - Java config
   - Spring Boot
   - manual bootstrap
3. whether the repo already has:
   - a copied `EnvironmentConfigurationValidator.java`
   - env-backed infrastructure such as Splunk, Hazelcast, datasource, broker, external service credentials
   - `.env.example` or `<artifactId>.env.example`
   - startup/deployment docs describing how env vars are exported
4. where env-dependent beans initialize
5. which settings are easy wins now versus legacy holdovers better deferred for a shared follow-up
   - first candidates: credentials/secrets
   - next candidates: instance-specific IDs, node-/environment-specific endpoints, or values that should not be shared blindly across clustered installs
   - usually leave stable non-sensitive defaults as committed properties

Always ask for clarification if the startup style or desired integration point is unclear.
Do not assume the user wants a broad all-at-once migration when a smaller phased pass would be cleaner.

## Phase 2: Adopt, Do Not Recreate

### Dependency rule

If the consuming repo does not already depend on `PRSCommonComponents`, add the dependency needed to import the shared classes.

Typical Maven dependency:

```xml
<dependency>
    <groupId>components</groupId>
    <artifactId>PRSCommonComponents</artifactId>
    <version><!-- choose the repo's appropriate versioning strategy --></version>
</dependency>
```

Do not guess the version if the consuming repo uses parent-managed versions, internal BOMs, or a local SNAPSHOT workflow. Inspect the repo and ask for clarification if needed.

After adding `PRSCommonComponents`, inspect the resolved dependency graph and compile/test classpath.

In older services, shared components may introduce legacy transitive dependencies that conflict with the consumer's servlet API, logging stack, Hazelcast client, or other runtime libraries. If that happens:

1. inspect `mvn dependency:tree`
2. add only the minimal exclusions needed in the consuming repo
3. verify the build again

Do not blindly copy exclusion lists from another repo unless the dependency graph and conflict are materially the same.

### Never do this by default

Do **not** generate:

- `src/main/java/.../EnvironmentConfigurationValidator.java`
- duplicate request/result/message classes
- ad hoc env validation logic that bypasses the shared implementation

Only create a tiny local adapter if the user explicitly wants one and there is a real integration reason.

## Phase 3: Declare Service-Specific Env Requirements

The consuming repo should declare its own env requirements while reusing shared validation behavior.

### Preferred request shape

```java
EnvironmentValidationRequest request = EnvironmentValidationRequest.builder()
    .serviceName("payerLimitingServiceApi")
    .warningVariables(Arrays.asList("SPLUNK_URL", "SPLUNK_TOKEN", "SPLUNK_INDEX"))
    .criticalVariables(Arrays.asList("HZ_ADDRESS", "HZ_GROUPNAME", "HZ_PASSWORD"))
    .build();
```

### Classification guidance

Common warning-tier examples:

- Splunk HEC configuration that should degrade gracefully in local/dev
- optional observability integrations

Common critical-tier examples:

- database URL / username / password
- Hazelcast credentials and address
- broker auth
- upstream credentials required for base startup

Keep the variable list service-specific. The shared library provides the behavior, not the requirements list.

## Phase 4: Choose the Right Integration Pattern

## A. Legacy Spring XML repos

Use the shared Spring helpers.

### Request bean

```xml
<bean id="environmentValidationRequest"
      class="com.recondotech.prs.config.env.spring.EnvironmentValidationRequestFactoryBean">
    <property name="serviceName" value="payerLimitingServiceApi"/>
    <property name="warningVariables">
        <list>
            <value>SPLUNK_URL</value>
            <value>SPLUNK_TOKEN</value>
            <value>SPLUNK_INDEX</value>
        </list>
    </property>
    <property name="criticalVariables">
        <list>
            <value>HZ_ADDRESS</value>
            <value>HZ_GROUPNAME</value>
            <value>HZ_PASSWORD</value>
        </list>
    </property>
</bean>
```

### Startup hook bean

```xml
<bean id="environmentValidationStartupHook"
      class="com.recondotech.prs.config.env.spring.EnvironmentValidationStartupHook">
    <property name="environmentValidationRequest" ref="environmentValidationRequest"/>
</bean>
```

### Ordering rule

Make env-dependent beans initialize after validation:

```xml
depends-on="environmentValidationStartupHook"
```

This is the preferred pattern for old WAR/Spring XML repos.

## B. Spring Boot repos

For Boot, prefer the earliest practical validation point.

### Best default: validate before `SpringApplication.run(...)`

```java
public static void main(String[] args) {
    EnvironmentValidationRequest request = EnvironmentValidationRequest.builder()
        .serviceName("payments-api")
        .warningVariables(Arrays.asList("SPLUNK_URL", "SPLUNK_TOKEN", "SPLUNK_INDEX"))
        .criticalVariables(Arrays.asList("DB_URL", "DB_USERNAME", "DB_PASSWORD"))
        .build();

    new EnvironmentConfigurationValidator().validate(request);

    SpringApplication.run(PaymentsApplication.class, args);
}
```

Use this when Boot auto-configures env-dependent infrastructure and you want the cleanest fail-fast behavior.

### Alternative: bean-managed startup hook

If the repo wants Spring-managed wiring and timing is acceptable:

```java
@Bean
public EnvironmentValidationRequest environmentValidationRequest() {
    return EnvironmentValidationRequest.builder()
        .serviceName("payments-api")
        .warningVariables(Arrays.asList("SPLUNK_URL", "SPLUNK_TOKEN", "SPLUNK_INDEX"))
        .criticalVariables(Arrays.asList("DB_URL", "DB_USERNAME", "DB_PASSWORD"))
        .build();
}

@Bean
public EnvironmentConfigurationValidator environmentConfigurationValidator() {
    return new EnvironmentConfigurationValidator();
}

@Bean
public EnvironmentValidationStartupHook environmentValidationStartupHook(
        EnvironmentConfigurationValidator validator,
        EnvironmentValidationRequest request) {
    return new EnvironmentValidationStartupHook(validator, request);
}
```

Use `@DependsOn("environmentValidationStartupHook")` only for beans you directly control.

## C. Non-Boot Java config / manual startup

If there is a manual bootstrap path, call the shared validator before env-dependent infrastructure initialization.

## Phase 5: Service-Specific Files That May Still Need Updates

The shared validator does **not** replace service-specific configuration/documentation work.

When the target settings are consumed through `PRSProperties`, prefer this shared runtime pattern over repo-local bootstrap helpers or broad caller rewrites:

```properties
prs.config.user=${env:PRS_CONFIG_USER}
prs.config.role=${env:PRS_CONFIG_ROLE:-DEVELOPMENT}
credential.rest.url=${env:CREDENTIAL_REST_URL}
```

Then keep Java callers unchanged:

```java
PRSProperties.getProperty("prs.config.user")
```

Use this selectively. Do not convert stable, non-sensitive defaults just for the sake of uniformity.

You may still need to update:

- prefer `<artifactId>.env.example` for WAR/Tomcat-style services; keep the deployed `<artifactId>.env` file out of git and check in only the example file
- deployment docs describing host startup export of env vars
- `log4j2.xml` env-backed properties
- XML or Java config for env-dependent infrastructure

Small phased-rollout example:

- **Do now:** Splunk/logging env vars, shared validation, env example file, Spring-friendly placeholder cleanup, and selective `PRSProperties` placeholder adoption for credentials or instance-specific values
- **Defer for later:** blanket property migration or non-cooperative XML consumers unless the user explicitly approves deeper work

If the deployment model uses a host or service startup script to source env files before Tomcat or Java starts, update those docs/scripts to use the artifact-specific env filename consistently.

But keep those concerns separate from the shared validator runtime.

## Deployment Model Rule

Do not add JVM-side `.env` parsing as the primary runtime model unless the user explicitly asks for a separate local-dev helper.

Expected model:

1. deployment/startup script exports environment variables
2. Java reads `System.getenv()`
3. shared validator validates those values

## Migration Guidance

Whenever a variable belongs in the env-validated set and is also consumed at runtime through `PRSProperties`, prefer keeping the validation and runtime source aligned:

1. validate the env var with the shared validator
2. back the corresponding legacy property key with `${env:...}` or `${env:...:-default}` when that setting is sensitive or deployment-specific
3. keep stable, non-sensitive committed defaults as ordinary properties

If the consuming repo already has a local validator class:

1. inspect its current warning/critical semantics
2. map those env vars into `EnvironmentValidationRequest`
3. replace local wiring with the shared `PRSCommonComponents` classes
4. remove the duplicated validator source if safe
5. keep service-specific `.env.example`, deployment docs, and startup ordering

Do not silently remove local code until you verify the shared implementation preserves the repo's required semantics.

## Output Expectations

When using this skill, the agent should usually produce:

1. a short adoption plan
2. the exact dependency change, if needed
3. the exact XML or Java wiring changes
4. a clear split between values that should remain committed defaults and values that should become env-backed
5. any `.env.example` or doc updates still needed in the consumer repo
6. validation notes explaining what was tested and what startup ordering assumptions remain

## Constraints

- Do not generate a new local validator by default
- Do not parse `.env` files inside Java as the primary mechanism
- Do not log secret values
- Do not hardcode secret values
- Do not assume Splunk is the only use case
- Do not couple the validator runtime to `log4j2.xml` mutation or `.env.example` generation
- Do not guess startup ordering in ambiguous repos; inspect and ask for clarification
- Do not turn a straightforward env-validation request into a broad legacy-config refactor unless the user clearly wants that
- Do not recommend env-backing every property by default; prefer credentials/secrets and other instance-/environment-specific values first
- If the consuming repo cannot yet import `PRSCommonComponents`, explain the dependency blocker clearly instead of falling back to code duplication without approval
