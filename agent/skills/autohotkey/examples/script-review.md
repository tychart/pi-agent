# Script Review Example

When reviewing a script, use this checklist:

1. Is it v1, v2, or mixed?
2. Does it include `#Requires AutoHotkey v2.0`?
3. Are strings quoted?
4. Are function calls valid v2 syntax?
5. Are hotkey blocks valid?
6. Does it rely on fragile sleeps or coordinates?
7. Does it need `WinWait` or `WinWaitActive`?
8. Does it preserve clipboard state when using the clipboard?
9. Does it include an exit hotkey for long-running behavior?
10. Is it safe to run?

Return:

```text
Diagnosis:
Fix:
Corrected script:
Test plan:
Safety notes:
```
