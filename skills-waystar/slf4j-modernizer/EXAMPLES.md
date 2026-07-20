# SLF4J Modernizer Examples

These examples are derived from the `PCS_Eligibility` logging-upgrade branch, but are written to stay adaptable.

## 1) Ordinary caller migration

### Before
```java
import org.apache.log4j.Logger;

public class PRSMain {
    private static final Logger logger = Logger.getLogger(PRSMain.class);

    public void start() {
        if (logger.isDebugEnabled()) {
            logger.debug("initializeCamel");
        }
    }
}
```

### After
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PRSMain {
    private static final Logger LOGGER = LoggerFactory.getLogger(PRSMain.class);

    public void start() {
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("initializeCamel");
        }
    }
}
```

Real repo reference:
- `prs/src/main/java/com/recondotech/prs/PRSMain.java`

## 2) Preferred org-standard backend support: shared `PRSCommonComponents`

When ordinary code needs backend-specific behavior, prefer the shared helper:

```java
import com.recondotech.prs.utils.LoggingBackendSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AdminProcessor {
    private static final Logger LOGGER = LoggerFactory.getLogger(AdminProcessor.class);

    public void changeLevel(String loggerName, String levelName) {
        LoggingBackendSupport.setLogLevel(loggerName, levelName);
        LOGGER.info("Requested log-level change for {}", loggerName);
    }
}
```

Why this matters:

- ordinary callers stay on SLF4J
- backend-only logic is centralized
- shared support is reusable across repos/modules

Real repo references:
- `prs/src/main/java/com/recondotech/prs/processors/AdminProcessor.java`
- `prsEligibility/pom.xml`

## 3) Repo-local fallback helper only when shared adoption is blocked

If `PRSCommonComponents` cannot be adopted yet, a narrow local fallback is acceptable temporarily:

```java
package com.example.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class LoggingBackendSupport {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingBackendSupport.class);

    private LoggingBackendSupport() {
    }

    public static void setLogLevel(String loggerName, String levelName) {
        // backend-specific implementation here
        LOGGER.info("Set logger {} to {}", loggerName, levelName);
    }
}
```

Use this only when there is a clear blocker to shared adoption.
Shape it so it can later be replaced by `com.recondotech.prs.utils.LoggingBackendSupport`.

## 4) MDC / context lifecycle migration

### Before
```java
import org.apache.logging.log4j.ThreadContext;

ThreadContext.put(TRANSACTION_ID, exchangeId);
...
if (exchangeId.equals(ThreadContext.get(TRANSACTION_ID))) {
    ThreadContext.remove(TRANSACTION_ID);
}
```

### After
```java
import com.recondotech.prs.utils.LoggingBackendSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

LoggingBackendSupport.putContextValue(TRANSACTION_ID, exchangeId);
...
LoggingBackendSupport.removeContextValueIfMatches(TRANSACTION_ID, exchangeId);
```

Why this matters:

- ordinary code stays backend-neutral
- lifecycle cleanup is reusable and testable
- backend-specific context operations do not leak across business classes

Real repo references:
- `prs/src/main/java/com/recondotech/prs/utils/interceptor/camel/CamelEventNotifier.java`
- `prs/src/test/java/com/recondotech/prs/utils/interceptor/camel/CamelEventNotifierTest.java`

## 5) Test bootstrap migration

### Preferred pattern
```java
import com.recondotech.prs.utils.LoggingBackendSupport;
import org.junit.BeforeClass;

public class LoggingBase {
    @BeforeClass
    public static void loggingSetUp() {
        LoggingBackendSupport.setLogLevel("org", "ERROR");
        LoggingBackendSupport.setLogLevel("com.mchange", "ERROR");
        LoggingBackendSupport.removeKnownTestRootAppenders();
    }
}
```

Real repo reference:
- `prs/src/test/java/com/recondotech/prs/test/util/LoggingBase.java`

## 6) Focused backend-support verification

A backend-support helper should have direct tests:

```java
@Test
public void testSetLogLevelValid() {
    LoggingBackendSupport.setLogLevel("com.example.Test", "INFO");
    assertEquals("INFO", LoggingBackendSupport.getEffectiveLogLevel("com.example.Test"));
}

@Test
public void testContextValueRoundTrip() {
    LoggingBackendSupport.putContextValue("transactionId", "abc123");
    assertEquals("abc123", LoggingBackendSupport.getContextValue("transactionId"));
    LoggingBackendSupport.removeContextValue("transactionId");
}
```

Real repo reference:
- `prs/src/test/java/com/recondotech/prs/utils/logging/LoggingBackendSupportTest.java`

Important reminder:
- these tests are necessary
- they are **not sufficient** to prove SLF4J is correctly bound at runtime

## 7) Real SLF4J smoke-path verification

Also include at least one path that proves a real SLF4J logger reaches the configured backend:

```java
private static final Logger LOGGER = LoggerFactory.getLogger(MySmokeTest.class);

@Test
public void testSlf4jIsActuallyBound() {
    LOGGER.info("smoke-test-event");
    // assert via configured appender / captured backend output / test backend hook
}
```

The exact assertion mechanism depends on the repo's logging configuration.
The point is to verify the SLF4J facade is not silently running on NOP.

## 8) `fatal` migration must preserve fail-fast behavior

### Before
```java
import org.apache.log4j.Logger;

public class PRSBatchRetrievalMain extends AbstractComponentMain {
    private static final Logger logger = Logger.getLogger(PRSBatchRetrievalMain.class);

    @Override
    protected void initializeCamel() throws Exception {
        try {
            camelContext.addRoutes(...);
        } catch (Exception ex) {
            logger.fatal("Error initializing Camel context: " + ex.getMessage(), ex);
        }
    }
}
```

### Wrong after
```java
catch (Exception ex) {
    logger.error("Fatal error initializing Camel context", ex);
    // BUG: startup now continues after a fatal path
}
```

### Preferred after
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PRSBatchRetrievalMain extends AbstractComponentMain {
    private static final Logger LOGGER = LoggerFactory.getLogger(PRSBatchRetrievalMain.class);

    @Override
    protected void initializeCamel() throws Exception {
        try {
            camelContext.addRoutes(...);
        } catch (Exception ex) {
            LOGGER.error("Fatal error initializing Camel context", ex);
            throw ex;
        }
    }
}
```

Why this matters:

- SLF4J has no `fatal`, so level mapping alone is not enough
- startup behavior is preserved only if the exception still escapes
- outer `main(...)` or lifecycle code can then handle cleanup/final shutdown consistently

Real repo references:
- `prsBatchComponent/src/main/java/com.recondotech.prs/PRSBatchComponentMain.java`
- `prsBatchComponent/src/main/java/com.recondotech.prs/PRSBatchRetrievalMain.java`

## 9) Custom appender/plugin migration is a separate track

### Before
```java
public class TestAppender extends AppenderSkeleton {
    @Override
    protected void append(LoggingEvent event) {
        ...
    }
}
```

### After
```java
import org.apache.logging.log4j.core.Appender;
import org.apache.logging.log4j.core.Core;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.plugins.Plugin;
import org.apache.logging.log4j.core.config.plugins.PluginFactory;

@Plugin(name = "TestAppender", category = Core.CATEGORY_NAME, elementType = Appender.ELEMENT_TYPE)
public class TestAppender extends AbstractAppender {
    @PluginFactory
    public static TestAppender createAppender(...) {
        ...
    }

    @Override
    public void append(LogEvent event) {
        ...
    }
}
```

Real repo reference:
- `prs/src/main/java/com/recondotech/prs/testAppender.java`

Important note:
- this class is an intentional backend exception
- it should stay on Log4j2 core/plugin APIs
- however, its internals should still follow good logging style where practical

## 10) Provider mismatch anti-example

A real branch pitfall to avoid:

```xml
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-api</artifactId>
    <version>2.0.x</version>
</dependency>
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-slf4j-impl</artifactId>
    <version>2.26.x</version>
</dependency>
```

This can produce runtime warnings like:

- `No SLF4J providers were found`
- `Ignoring binding found at ... log4j-slf4j-impl ...`

### Corrective rule

- if `slf4j-api` is **2.x**, use an SLF4J 2 provider such as `log4j-slf4j2-impl`
- verify with a real smoke test or surefire/startup output, not just compilation

Real repo evidence:
- `prs/pom.xml`

## 11) Bridge-removal reporting example

Do not remove `log4j-1.2-api` just because imports are gone.
Report the decision explicitly.

### If removed
```text
log4j-1.2-api: REMOVED
Reason: no remaining org.apache.log4j usage, no compatibility config flags, dependency tree clean, smoke verification clean.
```

### If kept
```text
log4j-1.2-api: KEPT
Reason: compatibility bridge still required by config/dependencies/runtime checks.
```

That explicit reporting is more important than guessing correctly the first time.
