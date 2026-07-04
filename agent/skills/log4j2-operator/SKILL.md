---
name: log4j2-operator
description: Migrate legacy Java repositories from Log4j 1.x or JUL to SLF4J + Log4j2, handling dependency updates, source code conversion, and verification.
---

# Log4j2 Operator Skill

## Purpose

Automatically detect current logging state in legacy Java repositories and migrate them to a standardized **SLF4J API + Log4j2 implementation** architecture. This skill operates across ~10-20 similar legacy Java 8/11 repos that use internal company Maven artifacts.

## Logging Modernization Standard

### Target Architecture

```
Application Code
        ↓
      SLF4J
        ↓
 log4j-slf4j-impl
        ↓
     Log4j2 (2.26.x)
        ↓
 Splunk / File / Console
```

### Guiding Principle

> Application code should be written against **SLF4J**, not Log4j2 directly. Log4j2 is the implementation; SLF4J is the contract. Compatibility bridges are temporary migration aids and must be removed once legacy logging APIs are fully eliminated.

### Why SLF4J

- Decouples application code from a specific logging framework
- Reduces framework lock-in
- Consistent logging APIs across all repos
- Better interoperability with third-party libraries
- Cleaner, more maintainable source code

### Why Log4j2

- High-performance asynchronous logging
- Structured logging capabilities
- Flexible appender architecture
- Existing Splunk integration patterns
- Enterprise standard within the organization

## Skill Behavior Rules

1. Convert direct Log4j 1.x logger usage to SLF4J
2. Convert java.util.logging (JUL) usage to SLF4J
3. Prefer SLF4J in all newly generated code
4. Ensure logging implementations are standardized on Log4j2
5. Preserve functionality during migration
6. Avoid removing compatibility bridges until code analysis confirms they are no longer required
7. Prefer abstraction over implementation-specific APIs
8. Leave application behavior unchanged while modernizing logging APIs

## Detection Phase

### Step 1: Scan for Legacy Logging Patterns

Search all Java source files (excluding test files initially) for:

**Log4j 1.x patterns:**
- `import org.apache.log4j.Logger;`
- `import org.apache.log4j.Level;`
- `import org.apache.log4j.Logger;`
- `Logger.getLogger(ClassName.class)`
- `Logger.getLogger(ClassName.class.getName())`
- `logger.log(Level.XXX, ...)`
- `logger.error("message" + variable)` — string concatenation
- `logger.info("message" + variable)` — string concatenation
- `logger.debug("message" + variable)` — string concatenation
- `logger.warn("message" + variable)` — string concatenation
- `private Logger logger` — non-final, non-static
- `private Logger logger = Logger.getLogger(...)` — inline initialization

**JUL (java.util.logging) patterns:**
- `import java.util.logging.Logger;`
- `import java.util.logging.Level;`
- `Logger.getLogger(ClassName.class.getName())`
- `logger.log(Level.SEVERE, ...)`
- `logger.log(Level.INFO, ...)`
- `logger.log(Level.WARNING, ...)`
- `logger.log(Level.FINE, ...)`
- `logger.log(Level.FINEST, ...)`
- `logger.log(Level.FINER, ...)`
- `logger.log(Level.SHOUT, ...)`
- `private Logger logger = Logger.getLogger(...)`

**Already-modern patterns (SLF4J):**
- `import org.slf4j.Logger;`
- `import org.slf4j.LoggerFactory;`
- `private static final Logger LOGGER = LoggerFactory.getLogger(...)`

### Step 2: Scan pom.xml for Logging Dependencies

Check for:
- `log4j-1.2-api` — compatibility bridge (legacy)
- `log4j-slf4j-impl` — SLF4J to Log4j2 bridge (modern)
- `slf4j-api` — SLF4J API (modern)
- `log4j-api` — Log4j2 API
- `log4j-core` — Log4j2 implementation
- `log4j-layout-template-json` — for ECS JSON layouts
- `log4j2-splunk-appender` — internal Splunk appender
- `disruptor` — LMAX disruptor for async logging
- Any other legacy logging JARs: `slf4j-log4j12`, `log4j-over-slf4j`, etc.

### Step 3: Report Findings

Before making any changes, present a summary:

```
=== LOG4J2 MIGRATION ANALYSIS ===
Repo: <artifactId>
Java Version: <source/target version>

Legacy Logging Patterns Found:
  Log4j 1.x usage: <count> files
  JUL usage: <count> files
  String concat logging: <count> occurrences
  Non-final Logger fields: <count> fields
  Already using SLF4J: <count> files

Current Dependencies:
  log4j2 version: <current version or "not found">
  log4j-1.2-api: <present/absent>
  log4j-slf4j-impl: <present/absent>
  slf4j-api: <present/absent>
  disruptor: <present/absent>

Files Requiring Changes: <list files or "none">
==================================
```

## Migration Phase

### Phase A: Java Source Code Changes

#### Pattern 1: Log4j 1.x Logger → SLF4J

**Before:**
```java
import org.apache.log4j.Logger;

public class MyService {
    private Logger logger = Logger.getLogger(MyService.class);
```

**After:**
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MyService {
    private static final Logger LOGGER = LoggerFactory.getLogger(MyService.class);
```

#### Pattern 2: JUL Logger → SLF4J

**Before:**
```java
import java.util.logging.Logger;
import java.util.logging.Level;

public class MyDao {
    private Logger logger = Logger.getLogger(MyDao.class.getName());
```

**After:**
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MyDao {
    private static final Logger LOGGER = LoggerFactory.getLogger(MyDao.class);
```

#### Pattern 3: `log(Level.XXX, ...)` → `logger.xxx(...)`

Map Level constants to SLF4J methods:
- `Level.FINEST` → `logger.trace()`
- `Level.FINER` → `logger.debug()`
- `Level.FINE` → `logger.debug()`
- `Level.INFO` → `logger.info()`
- `Level.WARNING` → `logger.warn()`
- `Level.SEVERE` → `logger.error()`
- `Level.SHOUT` → `logger.fatal()` (rare; prefer error())

**Before:**
```java
logger.log(Level.SEVERE, "Error deleting reservation", e);
logger.log(Level.FINEST, "Reading payer for " + payerId);
```

**After:**
```java
logger.error("Error deleting reservation", e);
logger.trace("Reading payer for {}", payerId);
```

#### Pattern 4: String Concatenation → Parameterized Logging

**Most common patterns to fix:**
- `logger.error("msg" + var, ex)` → `logger.error("msg {}", param, ex)`
- `logger.info("msg" + var)` → `logger.info("msg {}", param)`
- `logger.log(Level.XXX, "msg" + var, ex)` → `logger.xxx("msg {}", param, ex)`

**Do NOT change if:**
- The string is already using parameterized format
- The concatenation involves complex expressions where parameterized would reduce readability
- The log message is intentionally dynamic in structure (e.g., building JSON fragments)

**Before:**
```java
logger.log(Level.SEVERE, "Error getting reservations, " + e.getMessage(), e);
logger.error("Error attempting to get concurrency limits from the PRS Config Service, ", e);
```

**After:**
```java
logger.error("Error getting reservations", e);
logger.error("Error attempting to get concurrency limits from the PRS Config Service", e);
```

Note: When the exception is already passed as the second argument, avoid duplicating the message with `e.getMessage()`. Log4j2/SLF4J will include the message in the stack trace.

#### Pattern 5: Non-Final Logger Fields → `static final`

**Before:**
```java
private Logger logger = Logger.getLogger(ClassName.class);
```

**After:**
```java
private static final Logger LOGGER = LoggerFactory.getLogger(ClassName.class);
```

### Phase B: pom.xml Changes

#### Version Detection and Upgrade

1. Detect current `log4j2.version` property in `<properties>`
2. If present and < 2.26.0, update to latest 2.26.x
3. If absent, add `<log4j2.version>2.26.0</log4j2.version>`
4. Also detect and set `<log4j2-splunk-appender.version>4.0.0</log4j2-splunk-appender.version>`

#### Dependency Changes

**Always add:**
```xml
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-api</artifactId>
    <version>2.0.9</version> <!-- Match Log4j2 major version -->
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
    <artifactId>log4j-slf4j-impl</artifactId>
    <version>${log4j2.version}</version>
</dependency>
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-layout-template-json</artifactId>
    <version>${log4j2.version}</version>
</dependency>
```

**Always add disruptor if not present:**
```xml
<dependency>
    <groupId>com.lmax</groupId>
    <artifactId>disruptor</artifactId>
    <version>${lmax.version}</version>
</dependency>
```

**Add Splunk appender if target includes Splunk integration:**
```xml
<dependency>
    <groupId>components</groupId>
    <artifactId>log4j2-splunk-appender</artifactId>
    <version>${log4j2-splunk-appender.version}</version>
</dependency>
```

**Conditional removal — log4j-1.2-api:**

Only remove `log4j-1.2-api` if the code analysis phase confirms:
- Zero files contain `import org.apache.log4j.Logger`
- Zero files contain `Logger.getLogger(...)`
- Zero files contain `import org.apache.log4j.Level`

**Report the decision:**
```
log4j-1.2-api: REMOVED (legacy usage confirmed eliminated)
OR
log4j-1.2-api: KEPT as compatibility bridge (legacy usage detected — manual review needed)
```

#### Structural Cleanup (co-occurring changes)

Only handle these if they are directly related to the logging migration:
- Remove `<packagingExcludes>` from maven-war-plugin if it excluded `log4j2.xml`
- Remove commented-out `findbugs-maven-plugin` blocks that were removed during this migration
- Remove commented-out parent POM dependencies if they relate to logging
- Do NOT remove parent POM dependency unless explicitly requested

### Phase C: Post-Migration Verification

After applying changes:
1. Confirm all `import org.apache.log4j.*` references are gone from source
2. Confirm all `import java.util.logging.*` references are gone from source
3. Confirm `LoggerFactory.getLogger(ClassName.class)` is used consistently
4. Confirm Logger fields are `private static final Logger LOGGER`
5. Confirm pom.xml has the correct dependency set
6. Run `mvn compile` (or report that compilation should be verified)

## Error Handling

- If a file has mixed patterns (some SLF4J, some log4j1), convert only the legacy patterns
- If a Logger field is used in an instance context (non-static), keep it as non-static but change to SLF4J
- If a method uses varargs in a log statement, preserve the varargs syntax
- If the repo uses Log4j 1.x specific features (e.g., PatternLayout in code, not XML), flag for manual review

## Output Format

1. **Plan phase**: Present the full analysis and list all changes to be made
2. **Confirmation**: Wait for user confirmation before applying
3. **Apply phase**: Execute all changes
4. **Verify phase**: Report verification results

## Constraints

- Do NOT modify test files in the initial pass (report them separately)
- Do NOT remove parent POM dependencies unless explicitly requested
- Do NOT add exclusions to dependency blocks (leave to user)
- Do NOT change logger levels (preserve existing INFO/WARN/ERROR levels per logger)
- Do NOT modify log4j2.xml (that's the Splunk ECS Layout skill's job)
- Preserve all existing method signatures, class structure, and business logic
