---
name: splunk-config-validator
description: Generate EnvironmentConfigurationValidator.java for startup validation of Splunk environment variables, manage .env.example files, inject Property blocks into log4j2.xml, and verify SplunkHttp appender wiring.
---

# Splunk Config / Environment Validator Skill

## Purpose

Generate the environment validation infrastructure for Splunk logging configuration. This skill creates the `EnvironmentConfigurationValidator.java` component, manages the `.env.example` file, and ensures all required environment variables are declared, validated at startup, and properly wired into the log4j2.xml configuration.

## Context

This skill works in concert with the Splunk ECS Layout skill. While the ECS Layout skill handles the log format and Splunk appender configuration, this skill handles:

- Environment variable declarations (`.env.example`)
- Startup-time validation of required env vars
- Property block injection into log4j2.xml
- Graceful degradation when Splunk env vars are missing

## Skill Behavior Rules

1. Always generate `EnvironmentConfigurationValidator.java`
2. Always generate or update `.env.example` with Splunk vars and a generic secrets template
3. Always inject the Property block into log4j2.xml (if not already present)
4. Always validate that the SplunkHttp appender is wired to the Root logger
5. Never modify existing Spring beans or business logic
6. Use `System.err` for the primary startup warning (visible even if logging is broken)
7. Use `LogManager` (Log4j2) for the secondary warning (falls back silently)
8. Make the validator configurable — not hardcoded to only Splunk vars

## Phase 1: EnvironmentConfigurationValidator.java

### Always Generate

Create `src/main/java/<mainPackage>/utils/EnvironmentConfigurationValidator.java`:

```java
package <mainPackage>.utils;

import org.apache.logging.log4j.LogManager;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Component
public class EnvironmentConfigurationValidator {
    static final List<String> REQUIRED_ENVIRONMENT_VARIABLES = Collections.unmodifiableList(
            Arrays.asList("SPLUNK_URL", "SPLUNK_TOKEN", "SPLUNK_INDEX"));

    private final Map<String, String> environmentVariables;

    public EnvironmentConfigurationValidator() {
        this(System.getenv());
    }

    EnvironmentConfigurationValidator(Map<String, String> environmentVariables) {
        this.environmentVariables = environmentVariables == null
                ? Collections.<String, String>emptyMap()
                : environmentVariables;
    }

    @PostConstruct
    public void validate() {
        List<String> missingEnvironmentVariables = getMissingRequiredEnvironmentVariables();

        if (!missingEnvironmentVariables.isEmpty()) {
            String warningMessage = buildWarningMessage(missingEnvironmentVariables);
            writePrimaryWarning(warningMessage);
            logSecondaryWarning(warningMessage);
        }
    }

    List<String> getMissingRequiredEnvironmentVariables() {
        List<String> missingEnvironmentVariables = new ArrayList<>();

        for (String environmentVariableName : REQUIRED_ENVIRONMENT_VARIABLES) {
            String environmentVariableValue = environmentVariables.get(environmentVariableName);

            if (isBlank(environmentVariableValue)) {
                missingEnvironmentVariables.add(environmentVariableName);
            }
        }

        return missingEnvironmentVariables;
    }

    String buildWarningMessage(List<String> missingEnvironmentVariables) {
        return "Splunk logging is disabled or misconfigured. "
                + "Missing required environment variables: "
                + missingEnvironmentVariables;
    }

    void writePrimaryWarning(String warningMessage) {
        PrintStream standardError = System.err;
        standardError.println(warningMessage);
    }

    void logSecondaryWarning(String warningMessage) {
        try {
            LogManager.getLogger(EnvironmentConfigurationValidator.class)
                    .warn(warningMessage);
        } catch (Exception e) {
            // no-op: the System.err warning is the primary startup signal
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
```

### Customization Notes

- The `REQUIRED_ENVIRONMENT_VARIABLES` list should be configurable per project
- For projects that don't use Splunk, this list can be empty (no warnings)
- For projects with additional required env vars (database URLs, API keys, etc.), these can be added to the list

### Testability

The constructor accepts a `Map<String, String>` parameter, enabling unit tests:

```java
@Test
public void testMissingEnvVars() {
    Map<String, String> env = new HashMap<>();
    env.put("SPLUNK_URL", "");
    EnvironmentConfigurationValidator validator =
            new EnvironmentConfigurationValidator(env);
    List<String> missing = validator.getMissingRequiredEnvironmentVariables();
    assertThat(missing, containsInAnyOrder("SPLUNK_TOKEN", "SPLUNK_INDEX"));
}
```

## Phase 2: .env.example Generation

### Generate or Update

Create/update `.env.example` at the repo root:

```env
# This legacy WAR app does not auto-load .env files.
# Export these values into the runtime environment before starting Tomcat/the app.
# Example:
#   export SPLUNK_URL=https://http-inputs-<env>.splunkcloud.com:443
#   export SPLUNK_TOKEN=replace_me
#   export SPLUNK_INDEX=<env>_pcs
#   export APP_ENV=dev
#   export SERVICE_NAME=<project-name>
#   export HOST_NAME=$(hostname)

# --- SPLUNK LOGGING ---
SPLUNK_URL=https://http-inputs-<env>.splunkcloud.com:443
SPLUNK_TOKEN=replace_me
SPLUNK_INDEX=<env>_pcs
APP_ENV=dev
SERVICE_NAME=<project-name>
HOST_NAME=replace_me_or_hostname
SPLUNK_DISABLE_CERTIFICATE_VALIDATION=false

# --- OTHER SECRETS ---
# Add additional environment variables below as needed:
# DATABASE_URL=jdbc:postgresql://localhost:5432/mydb
# DATABASE_USERNAME=
# DATABASE_PASSWORD=
# API_KEY=
# REDIS_URL=
# See deployment documentation for full env var reference.
```

### Auto-Detection

- `<env>` → default to `dev`
- `<project-name>` → auto-detect from pom.xml `<artifactId>` (hyphenated)
- Replace `HOST_NAME=replace_me_or_hostname` with a comment suggesting `$(hostname)`

### Deployment Model Awareness

If the repo uses Docker, Kubernetes, or a different deployment model, adjust the header comment:

```env
# Docker:
# docker run -e SPLUNK_URL=... -e SPLUNK_TOKEN=... myapp

# Kubernetes:
# Use ConfigMaps/Secrets — see deployment/ directory

# Tomcat:
# Export before starting, or use setenv.sh
```

## Phase 3: log4j2.xml Property Block Injection

### If log4j2.xml Already Has Properties

Skip — do not duplicate.

### If log4j2.xml Is Missing Properties

Insert after `<Configuration status="info" name="<projectName>">`:

```xml
    <Properties>
        <Property name="serviceName">${env:SERVICE_NAME:-<default-service-name>}</Property>
        <Property name="sourceHost">${env:HOST_NAME:-${hostName}}</Property>
        <Property name="splunkUrl">${env:SPLUNK_URL:-}</Property>
        <Property name="splunkToken">${env:SPLUNK_TOKEN:-}</Property>
        <Property name="splunkIndex">${env:SPLUNK_INDEX:-}</Property>
        <Property name="splunkDisableCertificateValidation">${env:SPLUNK_DISABLE_CERTIFICATE_VALIDATION:-false}</Property>
    </Properties>
```

### Property Block Details

| Property | Env Var | Default | Purpose |
|----------|---------|---------|---------|
| `serviceName` | `SERVICE_NAME` | `<artifactId-hyphenated>` | Identifies the service in Splunk `source` field |
| `sourceHost` | `HOST_NAME` | `${hostName}` (Java system property) | Hostname for the `host` field in Splunk |
| `splunkUrl` | `SPLUNK_URL` | (empty — disables Splunk if not set) | HEC endpoint URL |
| `splunkToken` | `SPLUNK_TOKEN` | (empty) | Splunk HEC authentication token |
| `splunkIndex` | `SPLUNK_INDEX` | (empty) | Splunk target index |
| `splunkDisableCertificateValidation` | `SPLUNK_DISABLE_CERTIFICATE_VALIDATION` | `false` | For dev/stage environments with self-signed certs |

### Empty Default Behavior

When `SPLUNK_URL` is empty, the SplunkHttp appender will fail silently (no logs sent). This is by design — it allows services to start without Splunk configured in local/dev environments. The `EnvironmentConfigurationValidator` warns about missing vars at startup.

## Phase 4: Wiring Verification

### Verify Splunk Appender Is Wired

Check that `log4j2.xml` contains:
1. `<SplunkHttp name="SplunkLogger" ...>` in the Appenders section
2. `<AppenderRef ref="SplunkLogger"/>` in the Root logger
3. `<JsonTemplateLayout eventTemplateUri="classpath:EcsLayout.json" locationInfoEnabled="true"/>` inside the SplunkHttp appender

### If Splunk Appender Is Missing

Generate the SplunkHttp appender block (same as Phase 3) and add the AppenderRef. If neither the appender nor the AppenderRef exist, flag this for the Splunk ECS Layout skill.

## Error Handling

- If `EnvironmentConfigurationValidator.java` already exists, compare and only update if needed
- If `.env.example` already exists, merge new Splunk vars while preserving custom entries the user added
- If `log4j2.xml` does not exist, report that it needs to be created (do not generate from scratch — that's the ECS Layout skill's role)
- If the main package cannot be determined from source code, fall back to `com.example` or the directory name

## Output Format

1. **Plan phase**: Show the EnvironmentConfigurationValidator code (with project package), .env.example content, and any log4j2.xml Property block changes
2. **Confirmation**: Wait for user approval
3. **Apply phase**: Write the validator, create/update .env.example, inject Property block if needed
4. **Verify phase**: Confirm all three artifacts exist and are well-formed

## Constraints

- Do NOT modify Spring configuration files (base.xml, service.xml, etc.)
- Do NOT add the validator as a dependency in pom.xml (it uses standard Spring + Log4j2)
- Do NOT remove any existing environment variables from .env.example
- Do NOT hardcode values — all Splunk connection details must come from environment variables
- Do NOT change the validator's validation logic (it's a shared utility)
- If the repo has no Java source directory, skip the validator generation and only handle .env.example
- The validator should always run at startup (`@PostConstruct`) — never make it optional or lazy
