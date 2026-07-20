---
name: splunk-ecs-layout
description: Generate ECS-compliant JSON log layout, configure Splunk HEC appender in log4j2.xml, create environment configuration, and add MDC/ThreadContext integration for structured Splunk logging.
---

# Splunk ECS Layout Skill

## Purpose

Generate standardized structured JSON logging for Splunk for **framework-agnostic Java applications that use Log4j2 as the backend**.

This skill is meant to work across many repo shapes, including:

- legacy Java webapps
- Spring XML applications
- Spring Boot applications
- non-Spring Java services
- scheduled/background workers
- older WAR/JAR deployments with externalized runtime config

This skill is for:

- request / error log shipping to Splunk HEC
- `EcsLayout.json` generation or standardization
- `log4j2.xml` Splunk appender wiring
- env-backed Splunk configuration
- MDC population where the application model supports request/job/message context
- deployment/doc follow-through when external config or packaged config artifacts are part of the runtime model

This skill is **not** for repos that do not use Log4j2 as the logging backend.
If the repo uses another backend, stop and confirm before adapting anything.

This skill should coordinate with the shared env validation approach rather than inventing repo-local secret-loading or validator logic.

## Applicability and detection

Before editing, detect the repo's current shape at a high level:

- Is Log4j2 the backend already, or does the repo still need logging-backend migration work first?
- Is the app a web application, a background worker, or a non-request-driven service?
- Does the repo externalize runtime config through environment variables, property files, startup scripts, container manifests, or host service definitions?
- Does the repo package `log4j2.xml` and related JSON layout files inside the app artifact, or ship them separately?
- Does the repo already use a shared env validation mechanism such as the `env-validation` skill / PRSCommonComponents pattern?

Keep branching guidance high-level. Adapt to the repo's actual structure instead of assuming Tomcat, Spring MVC, or a specific packaging model.

## ECS Layout Standard

### Target

Applications should emit structured JSON logs that support:

- unified search and correlation across services
- reliable field extraction in Splunk
- consistent observability dashboards
- automated log parsing without regex

### Architecture

```text
Application code (prefer SLF4J + MDC)
                ↓
             Log4j2
                ↓
JsonTemplateLayout → EcsLayout.json
                ↓
       Splunk HEC / file appenders
```

## Skill Behavior Rules

1. Generate or update a complete `EcsLayout.json` using the **exact required baseline layout below** for logs sent to Splunk.
2. The baseline layout is the standard contract. Repo-specific fields may be added only as additive fields that do not remove or rename the required baseline fields unless the user explicitly approves a contract change.
3. Auto-detect project/service names from build metadata when available:
   - use `pom.xml` for Maven repos
   - use Gradle metadata when applicable
   - otherwise inspect the repo name and existing deploy/config docs
   - convert camelCase / PascalCase / mixed names to kebab-case when needed
   - strip technical suffixes such as `Api`, `Service`, or `Application` only when the repo already uses the shorter operational name
4. Preserve all existing appenders, logger levels, additivity settings, async/logger routing, and non-Splunk log destinations in `log4j2.xml`.
5. Preserve existing console/file patterns and rolling file behavior.
6. If the repo already uses the internal `components:log4j2-splunk-appender`, do not reintroduce legacy official-library wiring such as `packages="com.splunk.logging"` or old `includeMDC`/`type="raw"` attributes.
7. Prefer `org.slf4j.MDC` in ordinary application code. Only use Log4j2 `ThreadContext` directly when the repo already does so or a backend-specific need is explicit.
8. Keep test logging local-only; do not make tests depend on Splunk infrastructure.
9. Keep `EcsLayout.json` valid JSON. Do not insert comments into the JSON file itself.
10. When adding `SPLUNK_*` env vars, strongly prefer the shared `env-validation` skill instead of generating a repo-local validator or ad hoc secret-loading logic.
11. After the Splunk logging files/config are in place, direct the user/agent to run the `env-validation` skill so the required Splunk credentials and related env vars are wired into the repo's real runtime configuration model and validated at startup.
12. If the repo externalizes logging config or ships deploy-time config bundles, update packaging/docs so `log4j2.xml`, `EcsLayout.json`, any generated `log4j2Resources/**`, and the env example land where operators expect them.
13. When a repo consumes shared `components:log4j2-splunk-appender` resources, prefer a consumer-owned top-level `log4j2.xml` plus generated/unpacked shared resources rather than keeping divergent repo-local copies of `EcsLayout.json` or shared fragments.
14. Keep the instructions high-level enough to apply across many legacy repos, but specific enough to give an agent exact file targets, exact appender structure, and exact JSON layout content.

## Phase 1: ECS Layout Template Generation

Generate or update `EcsLayout.json` using this **required baseline content**, with the project/service names auto-detected:

```json
{
  "dateTime": {
    "utc": {
      "$resolver": "timestamp",
      "pattern": {
        "format": "MM/dd/yyyy HH:mm:ss.SSS'Z'",
        "timeZone": "UTC"
      }
    },
    "louisville": {
      "$resolver": "timestamp",
      "pattern": {
        "format": "MM/dd/yyyy hh:mm:ss.SSS a",
        "timeZone": "America/Louisville"
      }
    }
  },
  "severity": {
    "$resolver": "level",
    "field": "name"
  },
  "logger": {
    "$resolver": "logger"
  },
  "thread": {
    "$resolver": "thread"
  },
  "message": {
    "$resolver": "message",
    "stringified": true
  },
  "file": {
    "$resolver": "source",
    "field": "fileName"
  },
  "method": {
    "$resolver": "source",
    "field": "methodName"
  },
  "lineNumber": {
    "$resolver": "source",
    "field": "lineNumber"
  },
  "exception": {
    "exceptionClass": {
      "$resolver": "exception",
      "field": "className"
    },
    "exceptionMessage": {
      "$resolver": "exception",
      "field": "message"
    },
    "stackTrace": {
      "$resolver": "exception",
      "field": "stackTrace",
      "stackTrace": {
        "stringified": true
      }
    }
  },
  "sourceHost": "${sourceHost}",
  "projectName": "<AUTO-DETECTED>",
  "serviceName": "${serviceName}",
  "environment": {
    "$resolver": "mdc",
    "key": "environment"
  },
  "requestPath": {
    "$resolver": "mdc",
    "key": "requestPath"
  },
  "correlationId": {
    "$resolver": "mdc",
    "key": "correlationId"
  },
  "httpStatus": {
    "$resolver": "mdc",
    "key": "httpStatus"
  }
}
```

### Standardization rule

If the repo already has a shipped `EcsLayout.json`, inspect:

- current Splunk queries
- README / deployment docs
- any tests that assert emitted JSON
- any dashboards/alerts that may depend on the current shape

The default goal of this skill is to move repos toward the baseline layout above.

Before removing or renaming existing fields, confirm whether downstream Splunk queries, dashboards, alerts, or field extractions depend on them.
If needed:

- keep legacy fields temporarily alongside the required baseline fields
- add repo-specific fields additively
- document any temporary compatibility fields clearly in the plan

Do **not** silently break an established Splunk search contract.

### Auto-detection logic

1. Read `<artifactId>` from `pom.xml`.
2. Read `<name>` as a human-readable fallback.
3. Derive default `projectName` / `serviceName` from the repo's existing conventions, not from a blind string replacement.
4. If the repo already documents or hardcodes a deployed service slug, prefer that over a purely mechanical transform.
5. If `pom.xml` is missing, fall back to the repo directory name.

### Custom fields guidance

If the user wants project-specific extra fields, keep the JSON valid and add actual fields only.
Do not insert inline comments into `EcsLayout.json`.
Additional fields should normally appear after the required baseline fields and should not replace them.
Show extension examples in the plan or docs instead, for example:

```json
"version": { "$resolver": "property", "key": "app.version" }
```

## Phase 2: `log4j2.xml` Updates

### Step 1: Preserve existing content

Read the existing `src/main/resources/log4j2.xml` and preserve:

- all existing appenders
- all existing logger level configurations
- existing `PatternLayout` patterns
- existing rolling file configurations
- existing non-root logger routing and `additivity` behavior

### Step 2: Add or verify the Properties block

Insert or update a `<Properties>` block near the top of the configuration:

```xml
<Configuration status="info" name="<projectName>">
    <Properties>
        <Property name="serviceName">${env:SERVICE_NAME:-<default-service-name>}</Property>
        <Property name="sourceHost">${env:HOST_NAME:-${hostName}}</Property>
        <Property name="splunkUrl">${env:SPLUNK_URL:-}</Property>
        <Property name="splunkToken">${env:SPLUNK_TOKEN:-}</Property>
        <Property name="splunkIndex">${env:SPLUNK_INDEX:-}</Property>
        <Property name="splunkDisableCertificateValidation">${env:SPLUNK_DISABLE_CERTIFICATE_VALIDATION:-false}</Property>
    </Properties>
```

Use a default `serviceName` that matches the repo's deployed service slug, not just the raw artifactId.

If the repo is using shared `components:log4j2-splunk-appender` fragments, this properties block is the consumer-owned adapter layer from `${env:...}` values to the property names expected by the shared includes. In that case, expand it to include the shared fragment contract, for example:

```xml
<Configuration xmlns:xi="http://www.w3.org/2001/XInclude" status="info" name="<projectName>" strict="true">
    <Properties>
        <Property name="serviceName">${env:SERVICE_NAME:-<default-service-name>}</Property>
        <Property name="sourceHost">${env:HOST_NAME:-${hostName}}</Property>
        <Property name="splunkHost">${env:SPLUNK_HOST:-${sourceHost}}</Property>
        <Property name="splunkUrl">${env:SPLUNK_URL:-}</Property>
        <Property name="splunkToken">${env:SPLUNK_TOKEN:-}</Property>
        <Property name="splunkIndex">${env:SPLUNK_INDEX:-}</Property>
        <Property name="splunkDisableCertificateValidation">${env:SPLUNK_DISABLE_CERTIFICATE_VALIDATION:-false}</Property>
        <Property name="project.name">${env:PROJECT_NAME:-<default-service-name>}</Property>
        <Property name="project.version">${env:PROJECT_VERSION:-unknown}</Property>
    </Properties>
```

Only add optional runtime overrides such as `SPLUNK_HOST`, `PROJECT_NAME`, or `PROJECT_VERSION` to env examples/docs when the consuming repo actually wants operators to override them.

### Step 2a: Shared-resource composition pattern (`components:log4j2-splunk-appender`)

When the consuming repo should use the shared-resource composition model instead of owning a repo-local inline `SplunkHttp` definition:

1. Keep the repo-owned top-level `src/main/resources/log4j2.xml`.
2. Add `xmlns:xi="http://www.w3.org/2001/XInclude"` and use `xi:include` for shared fragments.
3. Keep repo-specific console/file/Tomcat appenders and logger levels local.
4. Replace the repo-local inline Splunk appender with includes such as:

```xml
<Appenders>
    <!-- local appenders remain here -->
    <xi:include href="log4j2Resources/appenders/log4j2-splunk-appender.xml"/>
</Appenders>

<Loggers>
    <Root level="info">
        <!-- local appender refs remain here -->
        <xi:include href="log4j2Resources/appenderRefs/log4j2-splunk-appender-ref.xml"/>
    </Root>
</Loggers>
```

5. Add the documented Maven unpack pattern so shared `log4j2Resources/**` and `EcsLayout.json` are generated into `src/main/resources` during the build.
6. If the repo uses `xi:include`, keep `xercesImpl` available in the consumer repo.
7. If `src/main/resources` is part of the shipped runtime config surface, ensure Maven resource copying uses a recursive include pattern such as `**/*`, not a top-level `*`, so nested `log4j2Resources/**` actually reach `target/classes` and packaged artifacts.
8. If the user wants the shared artifact to be the single source of truth, remove tracked repo-local ownership of generated `EcsLayout.json` / shared fragments and ignore the generated copies in git.

### Step 3: Add the Splunk appender

Append a request/error Splunk appender to `<Appenders>`:

```xml
<SplunkHttp name="SplunkLogger"
            url="${splunkUrl}"
            token="${splunkToken}"
            index="${splunkIndex}"
            batch_size_count="1"
            disableCertificateValidation="${splunkDisableCertificateValidation}"
            host="${sourceHost}"
            source="${serviceName}">
    <JsonTemplateLayout eventTemplateUri="classpath:EcsLayout.json" locationInfoEnabled="true"/>
</SplunkHttp>
```

Rules:

- preserve `batch_size_count="1"` unless the user explicitly wants different latency/throughput tradeoffs
- keep `locationInfoEnabled="true"` for request/error logs that rely on source/stack info
- if the repo already has additional Splunk appenders or specialized logger routes, preserve them

### Step 4: Add AppenderRef to the Root logger only if appropriate

If the main application logs flow through the root logger, add:

```xml
<AppenderRef ref="SplunkLogger"/>
```

But if the repo already uses more selective routing, match that existing structure instead of forcing root-only behavior.

### Step 5: Test resources

Generate a test-local `log4j2.xml` if the repo has test logging resources and one does not already exist.
If it already exists, preserve its local-only behavior.

Recommended shape:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="warn" name="<projectName>-test">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{ISO8601} %-5p [%t] %logger{36} %m%n"/>
        </Console>
    </Appenders>

    <Loggers>
        <Root level="info">
            <AppenderRef ref="Console"/>
        </Root>

        <!-- Mirror the repo's main logger levels as needed, but keep tests off Splunk -->
        <Logger name="<mainPackage>" level="info"/>
    </Loggers>
</Configuration>
```

Do not hardcode framework-specific logger entries unless the consuming repo already uses and needs them.
Detect the main package from the actual source tree; do not guess if multiple top-level packages exist.

### Step 6: Packaging / deployment follow-through

If the repo ships config externally or bundles deploy artifacts, inspect whether you also need to update:

- assembly descriptors
- packaging include lists
- deployment docs
- README file maps
- container manifests / Helm charts / task definitions / service-unit docs / startup scripts when they are the place env vars are actually introduced

Typical follow-through:

- ensure `log4j2.xml` and `EcsLayout.json` are shipped where operators expect them
- if config bundles already include logging files, add `EcsLayout.json` there too
- if shared-resource composition is used, also ship generated `log4j2Resources/**` anywhere the runtime expects externalized logging resources beside `log4j2.xml`
- if shared resources are unpacked into `src/main/resources`, verify the build actually copies nested paths like `log4j2Resources/**` into `target/classes`, the main artifact, and any deployment ZIP/tar bundles
- if runtime env vars are documented elsewhere, keep the logging docs aligned with that source of truth
- if the shared layout changes field names or nesting, explicitly document Splunk search/dashboard impacts instead of silently swapping the contract

## Phase 3: Environment Configuration

### Pick the right example-file shape for the repo

Do **not** default blindly to `src/main/resources/.env.example`.

Choose based on deployment model:

1. **Host-sourced env model**
   - prefer a repo-root file such as `<artifactId>.env.example` when the repo uses an artifact-specific convention
   - document where operators copy or source it
   - keep the real runtime env file out of git
2. **Generic env-example repo convention**
   - use `.env.example` only if that matches the repo's existing conventions
3. **Container/orchestrated deployments**
   - align with the repo's existing deployment model, such as manifests, ConfigMaps, Secrets, task definitions, or runtime env injection docs
4. **Classpath-resource-driven config**
   - use `src/main/resources/` only when the repo actually ships env-like config as a resource

### Example env configuration content

For repos that use environment variables directly, generate something like:

```env
# Splunk Logging Configuration
SPLUNK_URL=https://http-inputs-<env>.splunkcloud.com:443
SPLUNK_TOKEN=<replace_with_token>
SPLUNK_INDEX=<env>_pcs
SPLUNK_DISABLE_CERTIFICATE_VALIDATION=false

# Service Identification
SERVICE_NAME=<project-name>
HOST_NAME=replace_me_or_hostname
```

Only add `APP_ENV` or similar variables if the repo actually uses or documents them.
Do not add optional variables such as `SPLUNK_HOST`, `PROJECT_NAME`, or `PROJECT_VERSION` to an example env file unless the repo actually intends operators to set or override them.
If the repo uses a non-file-based deployment mechanism for env vars, adapt the documentation to that mechanism instead of forcing an env file.

### Deployment model rule

Document the real runtime model clearly:

- deployment/startup/runtime config injects environment variables using the repo's actual mechanism
- Java / Log4j2 reads from `System.getenv()` / `${env:...}`
- the application does **not** auto-load env files inside Java unless the user explicitly wants a separate helper

Possible mechanisms include host startup scripts, Tomcat service config, systemd environment files, container env injection, orchestration manifests, or CI/CD-managed runtime secrets.

### Env validation / secret handling guidance

This skill should strongly reference the shared `env-validation` skill as the companion follow-up step once Splunk logging setup is complete.

Expected sequence:

1. use this skill to add/update `EcsLayout.json`, `log4j2.xml`, MDC wiring, and env-variable documentation
2. then run the `env-validation` skill so the required Splunk credentials/env vars are properly introduced into the repo's runtime configuration model and validated during startup

Guidance:

- reference the `env-validation` skill for wiring/validating `SPLUNK_URL`, `SPLUNK_TOKEN`, and `SPLUNK_INDEX`
- preserve warning-vs-critical classification according to the consuming repo's needs
- do not generate a repo-local `EnvironmentConfigurationValidator.java` when shared PRSCommonComponents wiring is the intended pattern
- do not describe this skill itself as the secret-injection mechanism; use it to prepare the logging side, then use `env-validation` for the env/credential-validation side

### Index mapping guidance

Document index-to-environment mapping only when the repo already has a real convention.
Do not invent `stage` / `prod` mappings if the deployment docs say otherwise.

## Phase 4: SLF4J MDC Integration (Optional)

If the repo has a natural request/job/message processing boundary, generate or update MDC integration there.
Prefer `org.slf4j.MDC` in application code.

Typical places to attach MDC values:

- servlet filters or controller helpers in web applications
- message listener/interceptor boundaries in queue or stream consumers
- job runner wrappers in scheduled/background processes
- request-scoped middleware or framework hooks in other Java stacks

### Web-app filter template

If the repo is a servlet-based web application, a filter like this is a good default:

```java
package <mainPackage>.utils;

import org.slf4j.MDC;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class LoggingMdcFilter implements Filter {

    @Override
    public void doFilter(final ServletRequest req, final ServletResponse res, final FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        MDC.clear();
        MDC.put("requestPath", request.getRequestURI());

        try {
            chain.doFilter(req, res);
            MDC.put("httpStatus", Integer.toString(response.getStatus()));
        } finally {
            MDC.clear();
        }
    }
}
```

If the repo already has a request filter, interceptor, middleware class, or equivalent boundary hook, prefer updating that existing component instead of adding a second overlapping one.

### Response-status helper

If the repo has a `ControllerBase`, response helper, exception mapper, or similar shared abstraction, add:

```java
protected void setHttpStatus(final HttpStatus httpStatus) {
    if (httpStatus != null) {
        MDC.put("httpStatus", Integer.toString(httpStatus.value()));
    }
}
```

Then call `setHttpStatus()` from exception handlers and response builders.

### Correlation ID pattern

If the application has a stable request/job/message identifier such as `transactionId`, `id`, `correlationId`, `requestId`, or message key, you may add:

```java
MDC.put("correlationId", transactionId);
```

But only do this when:

- the repo actually has that identifier at a stable processing boundary, and
- the layout/docs are intentionally updated to emit and describe `correlationId`

## Output Format

1. **Plan phase**
   - show the proposed `EcsLayout.json` shape
   - list `log4j2.xml` changes
   - show the env example file location/content
   - call out any packaging/doc follow-through
   - explicitly state that `env-validation` should be run after Splunk setup is applied
2. **Confirmation**
   - wait for user approval before applying broad changes
3. **Apply phase**
   - write `EcsLayout.json`
   - update `log4j2.xml`
   - create/update the env example file
   - update MDC wiring if needed
   - update packaging/docs if the runtime model requires it
4. **Follow-up phase**
   - direct the user/agent to run the `env-validation` skill so Splunk credential/env-var wiring and startup validation are handled through the shared pattern
5. **Verify phase**
   - confirm `EcsLayout.json` is syntactically valid JSON
   - confirm `log4j2.xml` is well-formed XML
   - confirm test logging remains local-only

## Constraints

- Do **not** use this skill as-is for repos that are not using Log4j2 as the backend.
- Do **not** modify or remove existing appenders/logger levels unless the user explicitly asks.
- Do **not** change console pattern layouts unless the user explicitly asks.
- Do **not** remove existing logging configuration.
- Do **not** insert comments into `EcsLayout.json`.
- Do **not** blindly force a generic `.env.example` path when the repo uses artifact-specific env files or a non-file-based deployment model.
- Do **not** add Java-side `.env` parsing as the primary runtime model unless the user explicitly asks.
- Do **not** generate a repo-local env validator by default; strongly reference and defer to the `env-validation` skill / shared PRSCommonComponents pattern when env validation is needed.
- Do **not** reintroduce legacy official Splunk Java logging attributes when the repo already uses the internal `log4j2-splunk-appender`.
- Do **not** keep a hand-maintained repo-local `EcsLayout.json` or shared fragment copy when the user wants the shared artifact to be the single source of truth; generate/unpack it instead.
- Do **not** silently break downstream Splunk queries, dashboards, or alerts when standardizing old layouts; preserve compatibility fields temporarily when needed and document any unavoidable field-shape changes.
- Do **not** add `correlationId` or environment mappings to docs/layouts unless the consuming repo actually uses them.
- Preserve `batch_size_count="1"` and `locationInfoEnabled="true"` for the main request/error Splunk appender unless the user explicitly wants different behavior.
