---
name: autohotkey
description: create, review, debug, refactor, convert, and optionally test AutoHotkey v2 scripts for Windows automation. Use this skill when the user asks for AHK, AutoHotkey, hotkeys, hotstrings, remaps, Send/Click automation, clipboard automation, GUI automation, window management, v1-to-v2 migration, script debugging, or running AutoHotkey scripts from WSL/Windows.
---

# AutoHotkey Skill

## Primary behavior

Use this skill to help with AutoHotkey v2 scripting. Always prefer AutoHotkey v2 syntax unless the user explicitly requests v1.

Support these task types:

1. Create new scripts.
2. Improve existing scripts.
3. Debug errors.
4. Convert v1 scripts to v2.
5. Explain scripts.
6. Add safety, logging, and testing.
7. Run or test scripts locally when explicitly requested and available.

## Documentation lookup

Before writing or correcting non-trivial AutoHotkey v2 code, consult `references/docs-lookup-protocol.md`.

Use web search for current AutoHotkey v2 documentation when:
- Syntax is uncertain.
- The script uses advanced features.
- The user provides an error.
- The script interacts with a specific app.
- The script will be run locally.
- The script uses window controls, GUI, COM, DllCall, UI Automation, timers, callbacks, objects, maps, arrays, or migration from v1.

Prefer official AutoHotkey v2 documentation over examples from forums or Stack Overflow.

## Default script standards

Generated scripts should usually include:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force
```

Prefer:

- Explicit functions.
- Clear variable names.
- Small reusable helper functions.
- `WinWait`, `WinWaitActive`, `ClipWait`, and state checks over blind `Sleep`.
- Window titles, process names, controls, or UI Automation over screen coordinates.
- Logging or tooltips for scripts that are hard to observe.
- Escape hotkeys for long-running scripts.
- Guardrails for scripts that click, type, delete files, or change settings.

Avoid:

- AutoHotkey v1 command syntax.
- Implicit v1-style assignments.
- Unbounded loops without an exit condition.
- Fragile fixed coordinates unless the user explicitly needs them.
- Destructive file/system actions without warning.
- Running UI-affecting scripts without explicit user approval.

## Workflow for new scripts

1. Infer the user’s goal.
2. Ask only for missing details that are truly necessary.
3. Search docs if syntax or behavior is non-trivial.
4. Write a complete AutoHotkey v2 script.
5. Add customization notes.
6. Add a short test plan.
7. Add local run instructions when useful.

Return this structure:

1. Summary.
2. Complete `.ahk` script.
3. Customization points.
4. How to run.
5. Test plan.
6. Safety notes if applicable.

## Workflow for reviewing or debugging scripts

1. Identify whether the script is v1, v2, or mixed.
2. List likely issues.
3. Search docs for uncertain syntax or error messages.
4. Provide a corrected script or focused patch.
5. Explain the important fixes.
6. Add a minimal test plan.
7. Suggest safer or more robust alternatives.

## Workflow for v1-to-v2 conversion

Consult `references/ahk-v2-migration-v1-to-v2.md`.

Preserve behavior while converting:

- Command syntax to function syntax.
- Legacy assignments to expressions.
- Old clipboard usage to `A_Clipboard`.
- Old GUI patterns to v2 GUI object patterns.
- Old hotkey labels/subroutines to functions where useful.

Warn the user when exact behavior may differ.

## Local testing from WSL

Consult `references/testing-from-wsl.md`.

The configured AutoHotkey executable is:

```bash
/mnt/c/Users/tychart/AppData/Local/Programs/AutoHotkey/v2/AutoHotkey64.exe
```

Only run local scripts when the user explicitly asks for execution/testing.

Prefer this testing order:

1. Static review.
2. Syntax/smoke test.
3. Non-destructive test.
4. UI-affecting run only after explicit user approval.

Use `scripts/run_ahk_from_wsl.sh` for local execution.

## References

Load only the file needed for the current task:

- `references/docs-lookup-protocol.md`
- `references/ahk-v2-style-guide.md`
- `references/ahk-v2-basics.md`
- `references/ahk-v2-common-patterns.md`
- `references/ahk-v2-debugging.md`
- `references/ahk-v2-migration-v1-to-v2.md`
- `references/testing-from-wsl.md`
- `references/prompting-one-shot.md`
- `references/prompting-multi-shot.md`

Use `examples/` for few-shot examples when a user request resembles a stored pattern.
