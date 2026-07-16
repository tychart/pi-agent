# AutoHotkey v2 Documentation Lookup Protocol

Use this file before writing or correcting non-trivial AHK v2 code.

## Search first when uncertain

Use web search before generating final code when the task involves:

- An AHK command, function, object, callback, or directive whose exact v2 syntax is uncertain.
- Any error message from AutoHotkey.
- GUI automation.
- App-specific automation.
- Window controls.
- COM.
- UI Automation.
- `DllCall`.
- Registry edits.
- Startup or scheduled task behavior.
- Clipboard race conditions.
- v1-to-v2 migration.
- Running scripts from WSL.

## Preferred search queries

Start with one or more of:

```text
AutoHotkey v2 documentation <feature>
AutoHotkey v2 <function name>
AutoHotkey v2 <error message>
AutoHotkey v2 command line ErrorStdOut
AutoHotkey v2 Send documentation
AutoHotkey v2 Hotkeys documentation
AutoHotkey v2 WinWait documentation
AutoHotkey v2 ControlClick documentation
AutoHotkey v2 Gui documentation
AutoHotkey v2 FileAppend documentation
AutoHotkey v2 A_Clipboard documentation
AutoHotkey v2 v1 to v2 migration
```

## Source priority

Prefer:

1. Official AutoHotkey v2 documentation.
2. Official AutoHotkey forum posts from knowledgeable maintainers.
3. AutoHotkey changelog or GitHub release notes.
4. Microsoft documentation for Windows/PowerShell/WSL behavior.
5. Community examples only after validating syntax against official docs.

## What to verify

When using docs, verify:

- Function name.
- Parameter order.
- Whether parameters are strings, expressions, objects, callbacks, arrays, maps, or variable references.
- Return value.
- Exception behavior.
- Whether the feature is v2-only, v1-only, or changed from v1.
- Whether the code needs escaping.
- Whether a command-style v1 example must be rewritten for v2.

## User-facing explanation

When docs materially affect the answer, briefly mention what was verified.

Example:

```text
I verified the v2 form of WinWait/WinWaitActive and used function-call syntax rather than v1 command syntax.
```

Do not over-explain obvious syntax for simple scripts.
