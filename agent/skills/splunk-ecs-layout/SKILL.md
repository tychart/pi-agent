---
name: splunk-ecs-layout
description: Generate ECS-compliant JSON log layout, configure Splunk HEC appender in log4j2.xml, create environment configuration, and add MDC/ThreadContext integration for structured Splunk logging.
---

# Splunk ECS Layout Skill

## Purpose

Generate standardized Elastic Common Schema (ECS)-compliant JSON log layouts for structured Splunk logging integration. This skill generates the ECS layout template, configures the Splunk HTTP Event Collector (HEC) appender in log4j2.xml, and ensures consistent structured logging across all repositories.

## ECS Layout Standard

### Target

All applications must emit structured JSON logs that conform to a consistent schema, enabling:
- Unified search and correlation across services
- Reliable field extraction in Splunk
- Consistent observability dashboards
- Automated log parsing without regex

### Architecture

```
Application (SLF4J)
        ↓
    Log4j2
        ↓
JsonTemplateLayout → EcsLayout.json
        ↓
  Splunk HEC / File Appenders
```

## Skill Behavior Rules

1. Always generate a complete EcsLayout.json from the template below
2. Auto-detect project name from pom.xml `<artifactId>` or `<name>`
3. Preserve user's existing console/appender patterns from log4j2.xml
4. Add SplunkHttp appender + Property block to log4j2.xml
5. Add AppenderRef to Root logger for SplunkLogger
6. Keep the layout customizable with clear placeholder comments
7. Ensure locationInfo is enabled for stack traces
8. Preserve all existing appenders and logger levels in log4j2.xml

## Phase 1: ECS Layout Template Generation

Generate `src/main/resources/EcsLayout.json` using this template, with the project name auto-detected:

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
  "sourceHost": "${hostName}",
  "projectName": "<AUTO-DETECTED>",
  "serviceName": "<AUTO-DETECTED>",
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

### Auto-Detection Logic

1. Read `<artifactId>` from pom.xml → use as `projectName` (convert hyphens to dashes, e.g., `payerLimitingServiceApi` → `payer-limiting-service`)
2. Read `<name>` from pom.xml as a fallback for `serviceName`
3. If pom.xml is missing, fall back to directory name of the repo

### Customizable Fields (add comments in generated file)

```json
  // --- CUSTOMIZABLE FIELDS ---
  // Add project-specific fields below. Examples:
  // "version": { "$resolver": "property", "key": "app.version" }
  // "deploymentId": { "$resolver": "property", "key": "deployment.id" }
  // "clusterName": { "$resolver": "mdc", "key": "cluster" }
```

## Phase 2: log4j2.xml Updates

### Step 1: Preserve Existing Content

Read the existing `src/main/resources/log4j2.xml` and:
- Preserve ALL existing appenders (Console, LocalLog, TomcatLog, etc.)
- Preserve ALL existing logger level configurations
- Preserve existing PatternLayout patterns
- Preserve existing RollingRandomAccessFile configurations

### Step 2: Add Property Block

Insert a `<Properties>` block after the opening `<Configuration>` tag:

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

### Step 3: Add SplunkHttp Appender

Append a SplunkHttp appender to the `<Appenders>` section:

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

### Step 4: Add AppenderRef to Root Logger

Add `<AppenderRef ref="SplunkLogger"/>` to the `<Root>` logger block:

```xml
<Loggers>
    <Root level="info">
        <AppenderRef ref="Console"/>
        <AppenderRef ref="LocalLog"/>
        <AppenderRef ref="TomcatLog"/>
        <AppenderRef ref="SplunkLogger"/>
    </Root>
    <!-- existing <Logger> elements preserved -->
</Loggers>
```

### Step 5: Test Resources

Generate `src/test/resources/log4j2.xml` if it does not exist:

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

        <!-- Match main logger levels without external appenders -->
        <Logger name="<mainPackage>" level="info"/>
        <Logger name="org.springframework" level="error"/>
        <Logger name="org.apache" level="warn"/>
        <Logger name="org.eclipse.jetty" level="warn"/>
        <Logger name="com.mchange" level="warn"/>
        <Logger name="net.sf.ehcache" level="error"/>
        <Logger name="kafka" level="warn"/>
        <Logger name="com.mangofactory.swagger" level="warn"/>
        <Logger name="springfox.documentation" level="info"/>
        <Logger name="org.springframework.web.servlet.mvc" level="info"/>
        <Logger name="org.springframework.orm.jpa.JpaTransactionManager" level="error"/>
    </Loggers>
</Configuration>
```

**Detect main package** by scanning `src/main/java/<first-level-package>/` directories.

## Phase 3: Environment Configuration

### Generate `.env.example`

Create `src/main/resources/.env.example` (or at repo root if it makes more sense for the deployment model):

```env
# Splunk Logging Configuration
SPLUNK_URL=https://http-inputs-<env>.splunkcloud.com:443
SPLUNK_TOKEN=<replace_with_token>
SPLUNK_INDEX=<env>_pcs  # e.g., pcs_dev, pcs_qa, pcs_prod
SPLUNK_DISABLE_CERTIFICATE_VALIDATION=false

# Service Identification
SERVICE_NAME=<project-name>  # e.g., payer-limiting-service
HOST_NAME=replace_me_or_hostname  # Or use: HOST_NAME=$(hostname)

# Application Environment
APP_ENV=dev  # dev, qa, stage, prod

# --- OTHER SECRETS ---
# Add additional environment variables below as needed:
# DATABASE_URL=jdbc:postgresql://localhost:5432/mydb
# DATABASE_USERNAME=
# DATABASE_PASSWORD=
# API_KEY=
# See deployment documentation for full env var reference.
```

### Index-to-Environment Mapping

Document the recommended mapping:

| `APP_ENV` | `SPLUNK_INDEX` |
|-----------|----------------|
| `dev`     | `pcs_dev`      |
| `qa`      | `pcs_qa`       |
| `stage`   | `pcs_stage`    |
| `prod`    | `pcs_prod`     |

## Phase 4: ThreadContext / MDC Integration (Optional)

If the repo has a servlet filter or base controller class that processes requests, generate or update a filter to inject MDC fields:

### Generated Filter Template

```java
package <mainPackage>.utils;

import org.apache.logging.log4j.ThreadContext;
import org.springframework.stereotype.Component;
import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class LoggingMdcFilter implements Filter {

    @Override
    public void doFilter(final ServletRequest req, final ServletResponse res, final FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        // Clear any stale MDC context from previous requests
        ThreadContext.clearAll();
        ThreadContext.put("requestPath", request.getRequestURI());

        try {
            chain.doFilter(req, res);
            ThreadContext.put("httpStatus", Integer.toString(response.getStatus()));
        } finally {
            ThreadContext.clearAll();
        }
    }
}
```

### Base Controller MDC Helper (for Spring MVC apps)

If the repo has a `ControllerBase` or similar abstract class, add:

```java
protected void setHttpStatus(final HttpStatus httpStatus) {
    if (httpStatus != null) {
        ThreadContext.put("httpStatus", Integer.toString(httpStatus.value()));
    }
}
```

Then add `setHttpStatus()` calls to existing exception-handling methods and response-entity builders.

### Correlation ID Pattern

For REST APIs that accept a `transactionId` or `id` parameter, add:

```java
ThreadContext.put("correlationId", transactionId);
```

## Output Format

1. **Plan phase**: Show the ECS layout with auto-detected project name, list of log4j2.xml changes, and .env.example content
2. **Confirmation**: Wait for user approval
3. **Apply phase**: Write EcsLayout.json, update log4j2.xml, create/update .env.example, generate filter if needed
4. **Verify phase**: Confirm EcsLayout.json is syntactically valid JSON, log4j2.xml is well-formed XML

## Constraints

- Do NOT modify any existing appenders or logger levels in log4j2.xml
- Do NOT change Console pattern layouts
- Do NOT remove existing logging configuration
- Do NOT generate .env.example at repo root if the project uses a different deployment model (e.g., Kubernetes ConfigMaps) — use `src/main/resources/` as default
- Do NOT add exclusions to pom.xml dependencies (that's the Log4j2 Operator skill's responsibility)
- If `log4j2.xml` does not exist, generate a complete one (not just append)
- If `EcsLayout.json` already exists, compare and only update changed fields
- Preserve the `batch_size_count="1"` setting for Splunk (low latency)
- Keep `locationInfoEnabled="true"` for stack trace support
