---
name: slf4j-modernizer
description: Modernize legacy Java logging to an abstraction-first SLF4J API with a Log4j2 backend, including dependency cleanup, backend-facade patterns, test migration, and verification.
---

# SLF4J Modernizer Skill

## Purpose

Use this skill to migrate legacy Java repositories toward a consistent logging architecture where:

- ordinary application and test code logs through **SLF4J**
- **Log4j2** remains the backend implementation
- any operation that truly requires backend-specific APIs is isolated behind a small shared abstraction such as **`LoggingBackendSupport`**
- compatibility bridges are treated as temporary migration aids, not permanent architecture

This skill is designed for large, uneven, real-world codebases that may contain a mix of:

- Log4j 1.x
- JUL (`java.util.logging`)
- partial SLF4J adoption
- Log4j2 runtime/config usage
- custom appenders/layouts/plugins
- noisy or brittle test logging setup
- Splunk / ECS / async logging infrastructure

## Target Architecture

### Preferred layering

```text
Application / business code
        ↓
org.slf4j.Logger + LoggerFactory
        ↓
(shared backend facade only when needed)
        ↓
Log4j2 backend
        ↓
Console / File / Splunk / ECS / Async appenders
```

### Guiding rule

> If normal logging can be done with SLF4J, use SLF4J directly.
> If a task would otherwise require importing Log4j2 classes, route it through `LoggingBackendSupport` or an equivalent shared backend-support abstraction.

## Non-Negotiable Rules

1. **Do not leave ordinary application code on Log4j APIs.**
   - Use `org.slf4j.Logger` and `LoggerFactory` for normal logging.

2. **Do not scatter backend imports through business code.**
   - Centralize backend-only operations behind a shared abstraction.
   - Prefer the shared `LoggingBackendSupport` from common components when available.
   - Only create a repo-local fallback if the shared abstraction is not yet available.

3. **Do not blindly remove compatibility bridges.**
   - `log4j-1.2-api` and similar bridges stay until code, config, and dependency analysis say they are safe to remove.

4. **Do not mismatch SLF4J API major versions and providers.**
   - `slf4j-api` **2.x** requires an SLF4J 2 provider such as `log4j-slf4j2-impl`.
   - `slf4j-api` **1.7.x** uses the older `log4j-slf4j-impl` binding.
   - A compile pass is not enough; verify there are no runtime warnings like:
     - `No SLF4J providers were found`
     - `Ignoring binding found at ... log4j-slf4j-impl ...`

5. **Do not preserve poor logging style during migration.**
   - Prefer parameterized logging: `logger.info("value {}", value)`
   - Prefer `logger.error("message", ex)`
   - Avoid `System.out.println`, `printStackTrace()`, and `ex.getMessage()` duplication when the throwable is already logged.

6. **Do not silently hand-wave `fatal`.**
   - SLF4J has no fatal method.
   - Replace with `error(...)` deliberately and preserve any alerting/semantic expectations via message conventions or config review.

7. **Do not force backend abstraction onto true backend extension code.**
   - Custom appenders, layouts, filters, plugins, and Log4j2-core integrations are valid exceptions.
   - Keep those backend-specific, but keep them rare and well-labeled.

## Expected Execution Style

1. Analyze first.
2. Present findings and migration plan.
3. Get confirmation before broad edits unless the user explicitly asked for direct application.
4. Apply staged changes.
5. Verify both compile/test behavior and runtime logging wiring.

## Detection Phase

### 1) Scan source for legacy caller APIs

Search Java source first, then tests.

#### Log4j 1.x patterns
- `import org.apache.log4j.Logger;`
- `import org.apache.log4j.Level;`
- `Logger.getLogger(`
- `logger.log(Level.`
- `logger.fatal(`
- `AppenderSkeleton`
- `BasicConfigurator`
- `LogManager.getRootLogger().removeAppender(`

#### JUL patterns
- `import java.util.logging.Logger;`
- `import java.util.logging.Level;`
- `Logger.getLogger(`
- `logger.log(Level.`

#### Already-modern SLF4J patterns
- `import org.slf4j.Logger;`
- `import org.slf4j.LoggerFactory;`
- `LoggerFactory.getLogger(`

### 2) Scan for backend leakage into ordinary code

Look for direct Log4j2 imports outside explicit backend-support or plugin classes.

#### Usually should migrate behind `LoggingBackendSupport`
- `org.apache.logging.log4j.LogManager`
- `org.apache.logging.log4j.ThreadContext`
- `org.apache.logging.log4j.core.config.Configurator`
- `org.apache.logging.log4j.Level`
- direct root-appender mutation
- direct runtime logger level changes

#### Usually acceptable exceptions
- `@Plugin`
- `org.apache.logging.log4j.core.appender.AbstractAppender`
- `org.apache.logging.log4j.core.Layout`
- `org.apache.logging.log4j.core.Filter`
- `org.apache.logging.log4j.core.LogEvent`
- custom layouts / appenders / filters / plugins

### 3) Scan tests separately

Tests often hide the ugliest logging debt.

Look for:
- `BasicConfigurator.configure()`
- legacy `TestLogging.SetupLogging()` / `StopLogging()` style helpers
- direct root-appender cleanup
- hard-coded logger level mutations
- custom test appenders
- tests that assert log output or appender behavior

### 4) Scan build files and dependency graph

Check `pom.xml` files for:
- `slf4j-api`
- `log4j-api`
- `log4j-core`
- `log4j-slf4j-impl`
- `log4j-slf4j2-impl`
- `log4j-1.2-api`
- `log4j-layout-template-json`
- `disruptor`
- Splunk appender dependencies
- `slf4j-log4j12`
- `log4j-over-slf4j`
- legacy `log4j:log4j`
- `apache-log4j-extras`

Also inspect:
- parent POM properties and managed versions
- exclusions already in place
- `mvn dependency:tree` output when available

### 5) Scan runtime logging config

Do not stop at Java imports.

Inspect:
- module-local `log4j2.xml`
- included XML fragments
- generated or unpacked logging resources
- Splunk / ECS / async logging setup
- old compatibility flags or properties files that still assume legacy logging behavior

### 6) Detect provider/binding safety

If `slf4j-api` is 2.x, confirm the provider is also 2.x-compatible.

Explicitly check test output, startup logs, or surefire reports for warnings like:
- `No SLF4J providers were found`
- `Class path contains SLF4J bindings targeting slf4j-api versions 1.7.x or earlier`
- `Ignoring binding found at ...`

A migration is **not** complete if the code compiles but SLF4J is effectively running on NOP.

## Findings Report Format

Before editing, produce a summary like:

```text
=== SLF4J MODERNIZATION ANALYSIS ===
Repo: <artifactId>
Java Version: <version>

Caller API Findings:
  Log4j 1.x usage: <count> files
  JUL usage: <count> files
  Direct Log4j2 backend usage in ordinary code: <count> files
  Intentional Log4j2 plugin/extension code: <count> files
  Already using SLF4J: <count> files

Style Findings:
  String concatenation logs: <count>
  fatal() usages: <count>
  printStackTrace/System.out logging: <count>

Dependency Findings:
  slf4j-api: <version or absent>
  Log4j2 backend: <version or absent>
  SLF4J provider/binding: <artifact>
  log4j-1.2-api bridge: <present/absent>
  Splunk/ECS deps: <summary>
  Provider mismatch warnings: <yes/no>

Migration Shape:
  Simple caller conversion only: <yes/no>
  Shared backend facade required: <yes/no>
  Custom plugin/appender migration required: <yes/no>

Files likely requiring edits:
  - ...
===================================
```

## Decision Tree

### Case A: Only caller API cleanup is needed
Use straight SLF4J conversion.

### Case B: Caller code performs backend-only operations
Use or extend `LoggingBackendSupport`.

Typical triggers:
- runtime level changes
- MDC / ThreadContext access
- root appender inspection/removal
- backend-specific test bootstrapping

### Case C: Custom Log4j extension code exists
Treat it as a separate backend migration track.

Examples:
- custom appenders
- layouts
- filters
- plugins

Do not pretend those can be converted to “plain SLF4J.”

## Migration Phase

## Phase A — Normalize ordinary logger usage to SLF4J

### Pattern 1: Log4j 1.x logger → SLF4J

**Before**
```java
import org.apache.log4j.Logger;

public class MyService {
    private static final Logger logger = Logger.getLogger(MyService.class);
}
```

**After**
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MyService {
    private static final Logger LOGGER = LoggerFactory.getLogger(MyService.class);
}
```

### Pattern 2: JUL logger → SLF4J

**Before**
```java
import java.util.logging.Logger;
import java.util.logging.Level;

private Logger logger = Logger.getLogger(MyDao.class.getName());
```

**After**
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

private static final Logger LOGGER = LoggerFactory.getLogger(MyDao.class);
```

### Pattern 3: `log(Level.X, ...)` → level-specific method

Map carefully:
- `FINEST` → `trace`
- `FINER` / `FINE` → `debug`
- `INFO` → `info`
- `WARNING` → `warn`
- `SEVERE` → `error`
- `FATAL` intent → deliberate `error` policy review

**Before**
```java
logger.log(Level.SEVERE, "Error deleting reservation", e);
logger.log(Level.FINEST, "Reading payer for " + payerId);
```

**After**
```java
LOGGER.error("Error deleting reservation", e);
LOGGER.trace("Reading payer for {}", payerId);
```

### Pattern 4: String concatenation → parameterized logging

**Before**
```java
logger.info("payerId=" + payerId + ", source=" + source);
logger.error("Failure: " + e.getMessage(), e);
```

**After**
```java
LOGGER.info("payerId={}, source={}", payerId, source);
LOGGER.error("Failure processing request", e);
```

### Pattern 5: Logger field cleanup

Prefer:
```java
private static final Logger LOGGER = LoggerFactory.getLogger(MyClass.class);
```

Only keep non-static instance loggers if a framework or class design truly requires it.

## Phase B — Isolate backend-specific operations behind `LoggingBackendSupport`

### When to use the abstraction

Use the shared `LoggingBackendSupport` for anything that would otherwise require Log4j2 imports in ordinary code, especially:

- `Configurator.setLevel(...)`
- `ThreadContext.put/get/remove(...)`
- root logger appender cleanup
- targeted test logging setup

### Preferred abstraction shape

- small, static, caller-facing facade
- backend-neutral class name
- SLF4J used for the facade's own internal logging
- strict validation on inputs
- focused unit tests
- lives in shared common components when possible

### Example responsibilities

- `setLogLevel(loggerName, levelName)`
- `getEffectiveLogLevel(loggerName)`
- `putContextValue(key, value)`
- `getContextValue(key)`
- `removeContextValue(key)`
- `removeContextValueIfMatches(key, expectedValue)`
- `removeRootAppender(name)`
- `removeKnownTestRootAppenders()`

### Real-world PRS pattern to emulate

In `PCS_Eligibility`, the branch introduced `LoggingBackendSupport` to keep:
- runtime log-level control
- MDC / ThreadContext access
- root-appender cleanup for tests

out of ordinary callers.

This is the correct pattern to generalize.

### Example: context lifecycle

**Before**
```java
ThreadContext.put(TRANSACTION_ID, exchangeId);
...
if (exchangeId.equals(ThreadContext.get(TRANSACTION_ID))) {
    ThreadContext.remove(TRANSACTION_ID);
}
```

**After**
```java
LoggingBackendSupport.putContextValue(TRANSACTION_ID, exchangeId);
...
LoggingBackendSupport.removeContextValueIfMatches(TRANSACTION_ID, exchangeId);
```

Note the safety benefit: lifecycle cleanup can be standardized instead of repeated ad hoc.

## Phase C — Migrate tests deliberately

### What to change

Replace direct legacy logging setup in tests with backend-support calls.

**Preferred test-base pattern**
```java
@BeforeClass
public static void loggingSetUp() {
    LoggingBackendSupport.setLogLevel("org", "ERROR");
    LoggingBackendSupport.setLogLevel("com.mchange", "ERROR");
    LoggingBackendSupport.removeKnownTestRootAppenders();
}
```

### Test migration rules

- keep tests on SLF4J for ordinary logging
- use `LoggingBackendSupport` for backend-only test setup
- preserve tests that validate custom appenders/plugins
- add focused tests for new facade behavior
- add at least one smoke path proving SLF4J actually reaches the configured backend

### Must-have test verification

Do not stop at backend-only unit tests.

Also verify:
- an SLF4J logger is not NOP
- provider warnings are absent
- configured appenders/layouts still receive events

## Phase D — Handle custom backend/plugin code as exceptions

### Keep backend-specific when the code truly is backend-specific

Examples:
- Log4j2 `@Plugin` appenders
- classes extending `AbstractAppender`
- custom layouts or filters

### Migration expectation for custom appenders

A Log4j 1.x custom appender may require a true API rewrite, for example:
- `AppenderSkeleton` → `AbstractAppender`
- `LoggingEvent` → `LogEvent`
- plugin annotations (`@Plugin`, `@PluginFactory`)
- updated layout/event serialization behavior

### Exception rule

Backend plugin code may import `org.apache.logging.log4j.core.*` directly.
That is acceptable **only** for explicit plugin/extension code.

## Phase E — Update dependencies safely

### Preferred dependency strategy

1. Reuse parent/BOM-managed versions when the repo already has a standard.
2. If versions are local, align all logging artifacts intentionally.
3. Keep the API/provider majors compatible.
4. Do not leave multiple competing bindings/providers on the classpath.

### Safe dependency patterns

#### If using SLF4J 2.x
Use a 2.x provider, for example:
```xml
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-api</artifactId>
    <version>${slf4j.version}</version>
</dependency>
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-api</artifactId>
    <version>${log4j2.version}</version>
</dependency>
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-core</artifactId>
    <version>${log4j2.version}</version>
</dependency>
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-slf4j2-impl</artifactId>
    <version>${log4j2.version}</version>
</dependency>
```

#### If temporarily constrained to SLF4J 1.7.x
Use the older binding only with 1.7.x:
```xml
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-slf4j-impl</artifactId>
    <version>${log4j2.version}</version>
</dependency>
```

### Common supporting dependencies
Add only when justified by the repo's config/runtime needs:
- `log4j-layout-template-json`
- `disruptor`
- Splunk appender dependencies

### Compatibility bridge rule: `log4j-1.2-api`

Keep it until **all** of the following are true:

1. No direct `org.apache.log4j.*` usage remains.
2. No legacy helper/test bootstrap still expects Log4j 1 behavior.
3. No config/property flags still rely on compatibility behavior.
4. Dependency-tree review shows no remaining need.
5. Smoke tests and startup logs remain clean after removal.

Then report either:

```text
log4j-1.2-api: REMOVED (code, config, dependency, and runtime checks passed)
```

or

```text
log4j-1.2-api: KEPT as compatibility bridge (still required by code/config/dependencies)
```

## Phase F — Treat configuration as part of the migration

Inspect module-local logging config before assuming anything.

Pay special attention to:
- XInclude fragment layouts
- generated `log4j2Resources`
- Splunk wiring
- ECS JSON layout resources
- async logger/appender requirements
- module-specific logger levels

If a repo already uses a separate skill for Splunk/ECS layout or config validation, do not duplicate that work here; coordinate with that skill.

## Lightweight Implementation Checklist

- [ ] inventory legacy caller APIs
- [ ] inventory direct backend usage in ordinary code
- [ ] classify intentional plugin/extension classes
- [ ] pick SLF4J API version and matching provider intentionally
- [ ] normalize ordinary classes to `Logger` + `LoggerFactory`
- [ ] migrate backend-only operations behind `LoggingBackendSupport`
- [ ] migrate test setup and noisy test logging cleanup
- [ ] preserve or rewrite custom appender/plugin code as backend-specific code
- [ ] defer bridge removal until criteria are met
- [ ] review module logging config and generated resources

## Lightweight Verification Checklist

- [ ] no ordinary application classes still import `org.apache.log4j.*`
- [ ] no ordinary application classes import Log4j2 backend APIs directly
- [ ] intentional exceptions are limited to backend support and plugin code
- [ ] SLF4J provider/binding matches API major version
- [ ] no `No SLF4J providers were found` or ignored-binding warnings
- [ ] runtime log-level controls still work
- [ ] MDC/context lifecycle still works
- [ ] test bootstrap still suppresses noisy legacy appenders where needed
- [ ] custom appenders/plugins still load and function
- [ ] compile/tests or targeted smoke verification pass

## PRS Examples to Carry Forward

Use these repo patterns as models, not as hard-coded assumptions. See the companion `EXAMPLES.md` in this skill folder for copyable examples.

1. **Shared backend facade pattern**
   - `prs/src/main/java/com/recondotech/prs/utils/logging/LoggingBackendSupport.java`
   - demonstrates how to isolate Log4j2-only operations

2. **MDC/context lifecycle migration**
   - `prs/src/main/java/com/recondotech/prs/utils/interceptor/camel/CamelEventNotifier.java`
   - shows context set/cleanup routed through the abstraction

3. **Test setup cleanup**
   - `prs/src/test/java/com/recondotech/prs/test/util/LoggingBase.java`
   - shows noisy dependency logging and appender cleanup moved behind the abstraction

4. **Intentional backend plugin exception**
   - `prs/src/main/java/com/recondotech/prs/testAppender.java`
   - shows a true backend-specific appender migration that should remain Log4j2-core code

5. **Important anti-example**
   - this branch paired `slf4j-api` 2.x with `log4j-slf4j-impl`, which can produce ignored-binding / no-provider warnings
   - future migrations must explicitly prevent that mismatch

## Output Expectations

When using this skill, produce:

1. **Analysis summary**
2. **Planned changes grouped by caller code / backend abstraction / tests / dependencies / config**
3. **Explicit bridge decision**
4. **Explicit provider-compatibility decision**
5. **Verification results and remaining risks**

## Constraints

- Preserve business behavior.
- Preserve logger intent and levels unless there is a clear defect.
- Do not silently rewrite custom backend extension code into something fake or generic.
- Do not assume one module's logging config matches another.
- Do not claim success until runtime/provider wiring is verified.
