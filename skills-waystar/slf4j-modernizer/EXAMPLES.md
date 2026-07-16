# SLF4J Modernizer Examples

These examples were distilled from the `PCS_Eligibility` logging-upgrade branch and generalized for future repos.

## 1) Ordinary class migration

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

## 2) Backend-only operations belong behind `LoggingBackendSupport`

### Preferred facade shape
```java
public final class LoggingBackendSupport {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingBackendSupport.class);

    private LoggingBackendSupport() {
    }

    public static void setLogLevel(String loggerName, String levelName) {
        // validate input
        // map level safely
        // call backend-specific configurator
    }

    public static void putContextValue(String key, String value) {
        // backend MDC / ThreadContext interaction
    }

    public static void removeKnownTestRootAppenders() {
        // backend appender cleanup for tests
    }
}
```

Real repo reference:
- `prs/src/main/java/com/recondotech/prs/utils/logging/LoggingBackendSupport.java`
- `prs/src/test/java/com/recondotech/prs/utils/logging/LoggingBackendSupportTest.java`

## 3) MDC / context lifecycle migration

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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

LoggingBackendSupport.putContextValue(TRANSACTION_ID, exchangeId);
...
LoggingBackendSupport.removeContextValueIfMatches(TRANSACTION_ID, exchangeId);
```

Why this matters:
- ordinary caller code stays backend-neutral
- cleanup semantics become reusable and testable

Real repo reference:
- `prs/src/main/java/com/recondotech/prs/utils/interceptor/camel/CamelEventNotifier.java`
- `prs/src/test/java/com/recondotech/prs/utils/interceptor/camel/CamelEventNotifierTest.java`

## 4) Test bootstrap migration

### Preferred pattern
```java
@BeforeClass
public static void loggingSetUp() {
    LoggingBackendSupport.setLogLevel("org", "ERROR");
    LoggingBackendSupport.setLogLevel("com.mchange", "ERROR");
    LoggingBackendSupport.removeKnownTestRootAppenders();
}
```

Real repo reference:
- `prs/src/test/java/com/recondotech/prs/test/util/LoggingBase.java`

## 5) Custom appender migration is a separate track

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
- however, its own internals should still follow good logging style where practical

## 6) Provider mismatch anti-example

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
- verify with a real smoke test or surefire output, not just compilation

Real repo evidence:
- `prs/pom.xml`
- `prs/target/surefire-reports/TEST-com.recondotech.prs.processors.AccessProcessorTest.xml`
