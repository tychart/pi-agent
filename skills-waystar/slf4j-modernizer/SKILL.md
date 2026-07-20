---
name: slf4j-modernizer
description: Modernize legacy Java logging toward SLF4J callers with a Log4j2 backend, preferring shared PRSCommonComponents LoggingBackendSupport for backend-specific needs and verifying dependency/provider correctness.
---

# SLF4J Modernizer Skill

## Purpose

Use this skill to migrate legacy Java logging toward a consistent shape where:

- ordinary application and test code logs through **SLF4J**
- **Log4j2** remains the backend implementation unless the repo explicitly uses another backend strategy
- backend-only operations stay behind a narrow support abstraction instead of leaking through business code
- for this org, the preferred shared abstraction is **`com.recondotech.prs.utils.LoggingBackendSupport` from `components:PRSCommonComponents`**
- compatibility bridges are treated as temporary migration aids, not permanent architecture

This skill is meant for uneven real-world codebases that may contain a mix of:

- Log4j 1.x
- JUL (`java.util.logging`)
- partial SLF4J adoption
- direct Log4j2 runtime/config code
- custom appenders/layouts/plugins
- noisy test logging setup
- Splunk / ECS / async logging infrastructure
- generated or module-specific logging config fragments

## Core Stance

### Default rule

> Use plain SLF4J for as much as possible.
> Only reach for backend-specific support when a task truly requires backend behavior that SLF4J does not model.

### Preferred org-standard pattern

If the repo needs backend-specific logging behavior for tests, runtime level changes, MDC/context plumbing, or similar support work:

1. Prefer importing shared **`components:PRSCommonComponents`** support.
2. Use **`com.recondotech.prs.utils.LoggingBackendSupport`** as the default support surface.
3. Only create a repo-local fallback helper if there is a clear blocker to shared adoption.

### PRSCommonComponents consumer modernization note

For repos actively modernizing logging, **`components:PRSCommonComponents`** should be treated as the home of the shared `LoggingBackendSupport` abstraction, not as a logging dependency strategy to inherit blindly.

Important current org-specific caveat:

- `PRSCommonComponents` may intentionally export a legacy-compatible SLF4J-facing dependency posture so older consumers can still upgrade safely
- that is helpful for compatibility, but it is **not always the intended final dependency shape** for a repo that is actively modernizing its logging stack
- if provider/binding behavior is not lining up cleanly in the consuming repo, prefer explicitly shaping the consumer POM instead of guessing
- in practice, that usually means excluding the legacy transitive SLF4J artifacts from `PRSCommonComponents` and adding the consumer repo's intended SLF4J API + matching provider directly
- ordinary code in the consumer repo should still move toward plain SLF4J callers plus `LoggingBackendSupport` for backend-only operations

### What this skill is not

This skill is not just “replace imports.”
It should also guide:

- when to stop after caller cleanup
- when backend abstraction is needed
- when dependency/provider alignment must be fixed
- when custom backend plugin code is a legitimate exception
- how to verify that SLF4J is actually wired to the backend at runtime

## Target Architecture

```text
ordinary callers
    ↓
org.slf4j.Logger + LoggerFactory
    ↓
shared LoggingBackendSupport only when needed
    ↓
Log4j2 backend
    ↓
console / file / Splunk / ECS / async appenders
```

### Good boundary

- **Ordinary code:** `Logger`, `LoggerFactory`, parameterized SLF4J calls
- **Backend-support code:** runtime level changes, appender cleanup, MDC/context helpers, backend inspection
- **True backend exception code:** custom appenders, layouts, filters, plugins, Log4j2-core integrations

## Recommended Sequence

Keep this sequence moderately prescriptive, but adapt to the repo.

### 1) Audit before editing

Inspect:

- legacy caller APIs (`org.apache.log4j.*`, JUL)
- direct Log4j2 imports in ordinary code
- test logging setup debt
- backend/plugin classes that should remain backend-specific
- POM dependency/provider state
- module-local logging config and generated fragments

### 2) Normalize ordinary callers to SLF4J

Convert normal classes first:

- `org.apache.log4j.Logger` → `org.slf4j.Logger`
- `Logger.getLogger(...)` → `LoggerFactory.getLogger(...)`
- `log(Level.X, ...)` → the matching SLF4J level method
- concatenated log strings → parameterized logging where practical
- review every `fatal` call for both **log level** and **control-flow semantics**

Do not widen the migration yet unless the audit shows a real backend-specific need.

### 3) Adopt shared backend support if needed

If ordinary code still needs backend-only behavior, prefer:

- adding/importing **`components:PRSCommonComponents`**
- routing backend-specific work through **`com.recondotech.prs.utils.LoggingBackendSupport`**

Typical triggers:

- runtime log-level changes
- MDC / ThreadContext context management
- root appender cleanup in tests
- backend-aware test setup

### 4) Use a repo-local fallback only if blocked

If shared adoption is blocked by dependency constraints, publication lag, or repo policy:

- create a small repo-local `LoggingBackendSupport`-style helper
- keep the class backend-neutral in name
- keep its API narrow
- keep it shaped for later replacement by shared `PRSCommonComponents`

Treat that as an intermediate state, not the ideal end state.

### 5) Handle custom backend/plugin code separately

Do not try to force custom backend extension code into plain SLF4J.

Valid exceptions include:

- `@Plugin` classes
- `AbstractAppender`
- custom layouts/filters
- other `org.apache.logging.log4j.core.*` extension points

These may remain backend-specific while ordinary caller code is cleaned up.

### 6) Then review dependencies and config

Only after code shape is clearer, review:

- SLF4J API/provider compatibility
- whether the consuming repo should keep or exclude transitive logging artifacts from shared components such as `PRSCommonComponents`
- bridge necessity (`log4j-1.2-api`, similar artifacts)
- classpath conflicts
- module-local `log4j2.xml`
- included/generated logging resources
- Splunk / ECS / async logger requirements

## Stop-and-Confirm Checkpoints

Pause and confirm with the user before widening scope when you move from caller cleanup into:

- adding or changing shared/common-component dependencies
- changing provider/binding artifacts
- removing compatibility bridges
- rewriting logging config resources
- changing behavior that may affect alerting or operational parsing

This branch showed that caller migration, backend abstraction, and dependency cleanup can move at different speeds.

## Detection Guidance

### Legacy caller patterns

Look for:

- `import org.apache.log4j.Logger;`
- `import org.apache.log4j.Level;`
- `Logger.getLogger(`
- `logger.log(Level.`
- `logger.fatal(`
- `BasicConfigurator`
- `AppenderSkeleton`
- `LogManager.getRootLogger().removeAppender(`
- `import java.util.logging.Logger;`
- `import java.util.logging.Level;`

When `fatal` appears, also inspect the surrounding call path:

- is this inside `main(...)`, startup/bootstrap, route initialization, or dependency wiring?
- does the old code rely on the exception continuing upward to stop the program?
- is there an outer catch/finally that performs shutdown, cleanup, or process-failure reporting?

### Direct backend leakage in ordinary code

Usually migrate these behind `LoggingBackendSupport`:

- `org.apache.logging.log4j.LogManager`
- `org.apache.logging.log4j.ThreadContext`
- `org.apache.logging.log4j.core.config.Configurator`
- direct backend level mutation
- direct root appender mutation

### Legitimate backend exceptions

Usually acceptable when the class is truly backend-specific:

- `@Plugin`
- `AbstractAppender`
- `Layout`
- `Filter`
- `LogEvent`
- other Log4j2-core extension surfaces

### Test-specific debt

Tests often preserve the worst legacy patterns. Check for:

- `BasicConfigurator.configure()`
- legacy setup helpers
- direct root-appender cleanup
- hard-coded backend logger mutation
- test appenders or custom backend fixtures

### Build/config review

Inspect:

- child and parent POMs
- exclusions already in place
- `mvn dependency:tree` when available
- module-local `log4j2.xml`
- XInclude fragments
- generated/unpacked `log4j2Resources`
- Splunk / ECS resources and async requirements

## Migration Rules

## 1) Ordinary callers stay on SLF4J

Preferred field shape:

```java
private static final Logger LOGGER = LoggerFactory.getLogger(MyClass.class);
```

Strong recommendations:

- prefer parameterized logging
- prefer `logger.error("message", ex)`
- avoid `ex.getMessage()` duplication when the throwable is already logged
- convert legacy `fatal` intentionally to an `error`-level policy that preserves operational intent
- preserve the **original stop/fail-fast behavior** when `fatal` previously marked an unrecoverable startup or bootstrap failure

### `fatal` replacement default

Because SLF4J has no `fatal` level, the default replacement rule is:

> If `logger.fatal(...)` represented an unrecoverable path, especially during startup or initialization, do **not** merely downgrade it to `logger.error(...)` and continue.
> Log at `error`, then rethrow/throw so the original termination behavior is preserved.

Typical safe patterns:

- inner initializer/startup method:
  - `logger.error("Fatal error initializing ...", ex);`
  - `throw ex;`
- when the method cannot throw the same checked exception cleanly:
  - `logger.error("Fatal error initializing ...", ex);`
  - `throw new IllegalStateException("Fatal error initializing ...", ex);`
- top-level `main(...)` with cleanup in `finally`:
  - let the inner initializer rethrow so the outer boundary remains responsible for final shutdown/cleanup behavior

Do **not** silently change:

- fail-fast startup into log-and-continue behavior
- exception propagation into local swallowing
- outer cleanup/error-reporting paths that depended on the exception escaping

These are strong recommendations, not reasons to block a valid backend plugin class from remaining backend-specific.

## 2) Shared `LoggingBackendSupport` is the default backend path

When backend behavior is needed, prefer shared support rather than inventing local helpers.

Typical responsibilities:

- `setLogLevel(loggerName, levelName)`
- `getEffectiveLogLevel(loggerName)`
- `putContextValue(key, value)`
- `getContextValue(key)`
- `removeContextValue(key)`
- `removeContextValueIfMatches(key, expectedValue)`
- test root-appender cleanup helpers

If the shared helper is unavailable, create only the minimum repo-local fallback surface needed.

## 3) Intermediate-state guidance

Some repos will be mid-migration.
That is acceptable temporarily if it is explicit.

Examples of acceptable intermediate states:

- caller code mostly converted to SLF4J while a repo-local helper exists temporarily
- `log4j-1.2-api` still present because config/dependencies are not yet clean
- custom plugin code still on Log4j2-core APIs
- style cleanup not fully complete in backend exception classes

Document what remains and why. Do not present an intermediate state as the final ideal architecture.

## 4) Do not over-migrate

If a repo already uses SLF4J correctly in ordinary code and only has a narrow backend-support need:

- do not churn unrelated classes
- do not create needless abstractions
- do not remove bridges or bindings without evidence
- focus on the smallest change that improves architecture and safety

## Dependency Rules

### Provider compatibility is mandatory

You must verify SLF4J API/provider major-version compatibility.

- `slf4j-api` **2.x** requires an SLF4J 2 provider such as `log4j-slf4j2-impl`
- `slf4j-api` **1.7.x`/`1.6.x** is the era for older bindings such as `slf4j-log4j12` or `log4j-slf4j-impl`, depending on the stack being preserved

Do not accept compile success as proof.
A bad combination can compile while leaving SLF4J effectively unbound at runtime.

For repos actively modernizing around shared `PRSCommonComponents` support, do not assume the shared component's transitive SLF4J artifacts are the right final answer for the consumer. If the consumer is moving to a clean SLF4J 2 + Log4j2 provider shape, explicitly exclude the legacy transitive SLF4J artifacts from `PRSCommonComponents` and add the intended API/provider pair directly in the consumer repo.

### Bridge removal is evidence-based

For repos actively modernizing logging, the normal goal is to remove `log4j-1.2-api` rather than keep it indefinitely.
Do not remove it until all of the following are true:

1. no direct `org.apache.log4j.*` usage remains
2. no legacy test/helper bootstrap still depends on Log4j 1 behavior
3. no config/property compatibility behavior still depends on it
4. dependency-tree review shows no remaining need
5. smoke/startup verification stays clean after removal

Report the bridge decision explicitly as kept or removed, with reasons.

### Keep classpath intent clear

Review for:

- multiple competing bindings/providers
- stale transitive logging artifacts
- exclusions that still matter
- parent-managed versions vs child overrides
- shared-component version ownership

## Verification Rules

### Backend-helper unit tests are not enough

A helper test may pass even if SLF4J is misbound or running on NOP.

Also require at least one **real SLF4J path** that proves:

- an SLF4J logger is active
- the configured provider is actually loaded
- the backend/appender path receives events as expected

### Verify runtime/provider wiring

Check for warnings such as:

- `No SLF4J providers were found`
- `Ignoring binding found at ...`
- provider/binding mismatch warnings

Treat those as migration failures or explicit follow-up items, not harmless noise.

### Verify module config, not just Java code

Where applicable, inspect:

- module-local `log4j2.xml`
- generated/unpacked resources
- XInclude fragments
- Splunk/ECS layouts
- async logger/appender dependencies

### Verify operational behaviors still work

When relevant, confirm:

- runtime log-level changes still work
- MDC/context lifecycle still works
- noisy test logging suppression still works
- custom appenders/plugins still load and function
- startup/init failure paths that previously used `fatal` still stop the program or propagate failure as intended

## Findings / Output Expectations

When using this skill, produce:

1. **Analysis summary**
2. **Planned changes grouped by caller code / backend support / tests / dependencies / config**
3. **Explicit provider-compatibility decision**
4. **Explicit bridge decision**
5. **Verification results and remaining risks**

## Companion Docs

Use companion docs in this skill folder for sharper detail:

- `EXAMPLES.md` — copyable migration patterns
- `PITFALLS.md` — concise real-world mistakes and anti-patterns

## PRS-derived lessons worth generalizing

These repo findings should shape the skill without turning it into a repo-specific recipe:

- broad caller migration to SLF4J can and should be separated from backend abstraction work
- shared `PRSCommonComponents` `LoggingBackendSupport` is the preferred org-standard end state
- repo-local helpers are a fallback, not the target
- custom backend appender/plugin code is a real exception, not a failed migration
- provider/binding mismatch can survive compilation and only show up in test/runtime output
- backend-helper tests alone do not prove SLF4J is wired correctly

## Constraints

- Preserve business behavior.
- Preserve logger intent unless there is a clear defect.
- Do not silently erase `fatal` semantics without reviewing operational expectations.
- Default expectation: replace unrecoverable `fatal` paths with `error` + rethrow/throw so the original failure behavior is preserved.
- Do not rewrite true backend extension code into fake generic wrappers.
- Do not assume one module's logging config matches another.
- Do not claim success until runtime/provider wiring is verified.
