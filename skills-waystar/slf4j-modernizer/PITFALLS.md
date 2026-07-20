# SLF4J Modernizer Pitfalls

Use this file as a concise checklist of mistakes that commonly survive a superficial logging migration.

## 1) Caller migration completed, but runtime wiring is still broken

Symptom:
- ordinary classes now use `org.slf4j.Logger`
- compilation passes
- backend-helper unit tests pass
- but runtime/test output shows warnings like:
  - `No SLF4J providers were found`
  - `Ignoring binding found at ...`

Meaning:
- SLF4J may be misbound or effectively running on NOP
- compile success did **not** prove the migration was complete

What to do:
- verify `slf4j-api` and provider major versions match
- run at least one real SLF4J smoke path through the configured backend
- inspect surefire/startup logs, not just unit assertions

## 2) Removing `log4j-1.2-api` too early

Symptom:
- direct `org.apache.log4j` imports are gone
- someone removes the bridge immediately
- tests, startup, or compatibility config then break

Meaning:
- import cleanup alone was not enough evidence

What to do:
- require code, config, dependency-tree, and runtime evidence before bridge removal
- report the bridge decision explicitly as kept or removed

## 3) Scattering backend APIs through ordinary code

Symptom:
- business classes start importing `ThreadContext`, `Configurator`, or other backend APIs directly

Meaning:
- the migration replaced one kind of logging sprawl with another

What to do:
- keep ordinary callers on SLF4J
- route backend-specific behavior through `com.recondotech.prs.utils.LoggingBackendSupport`
- if shared adoption is blocked, use a narrow repo-local fallback only temporarily

## 4) Treating custom appenders/plugins like normal callers

Symptom:
- a migration tries to convert custom Log4j appenders/plugins into generic SLF4J-only code

Meaning:
- the code's actual responsibility was misclassified

What to do:
- keep true backend extension code backend-specific
- limit exceptions to explicit plugin/extension classes
- still clean up style issues inside those classes where practical

## 5) Leaving style debt untouched when it changes meaning

Examples:
- `System.out.println`
- `printStackTrace()`
- `logger.error("Failure: " + ex.getMessage(), ex)`
- silent/drifting `fatal` semantics

Meaning:
- the migration may still work, but the resulting skill guidance will be weaker and noisier

What to do:
- prefer parameterized SLF4J logging
- prefer `logger.error("message", ex)`
- review how `fatal` intent should map to `error`
- treat style cleanup as a strong recommendation with exceptions, not as the whole migration

## 6) Downgrading `fatal` to `error` but accidentally changing control flow

Symptom:
- `logger.fatal(...)` gets replaced with `logger.error(...)`
- the exception is no longer thrown or rethrown
- startup or initialization now logs a fatal-looking message and keeps going

Meaning:
- the log line changed level successfully
- but the program behavior changed from fail-fast to log-and-continue

What to do:
- inspect every `fatal` call in context, not in isolation
- if the old path was unrecoverable, prefer `logger.error("...", ex); throw ex;`
- if the method cannot propagate the same exception type cleanly, throw a wrapped unchecked exception
- keep outer `main(...)` / cleanup / shutdown behavior intact when it depended on exception propagation

## 7) Ignoring module-local logging config

Symptom:
- code imports are modernized
- but module-specific `log4j2.xml`, XInclude fragments, Splunk/ECS resources, or generated fragments were never checked

Meaning:
- runtime behavior may still be wrong even though Java code looks modern

What to do:
- inspect module-local config
- inspect generated/unpacked logging resources when the build uses them
- do not assume one module's config represents the whole repo
