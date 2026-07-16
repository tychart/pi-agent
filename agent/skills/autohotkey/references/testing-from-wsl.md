# Testing AutoHotkey v2 from WSL

## Configured AutoHotkey path

Windows path:

```text
C:\Users\tychart\AppData\Local\Programs\AutoHotkey\v2\AutoHotkey64.exe
```

WSL path:

```bash
/mnt/c/Users/tychart/AppData/Local/Programs/AutoHotkey/v2/AutoHotkey64.exe
```

## Basic execution

From WSL, run:

```bash
"/mnt/c/Users/tychart/AppData/Local/Programs/AutoHotkey/v2/AutoHotkey64.exe" "$(wslpath -w ./script.ahk)"
```

Prefer the helper:

```bash
./scripts/run_ahk_from_wsl.sh ./script.ahk
```

## Safety policy

Do not run scripts automatically unless the user explicitly asks.

Never run destructive or UI-affecting scripts without clear user approval.

Classify the script before running:

1. Static-only: safe to review, no execution.
2. Smoke test: shows MsgBox/logs only.
3. Non-destructive automation: may open apps or type into test windows.
4. UI-affecting automation: sends keys/clicks to real apps.
5. Destructive/system-changing: deletes files, edits registry, changes settings, closes apps, sends messages, submits forms.

For categories 4 and 5, ask for explicit approval before running.

## Recommended test flow

1. Save the script to a temporary `.ahk` file.
2. Run static review.
3. If the script has no UI side effects, run with a timeout.
4. Capture exit code.
5. Check any log file produced by the script.
6. Report results and suggested fixes.

## Path conversion

Use:

```bash
wslpath -w ./script.ahk
```

This converts a WSL path into a Windows path for AutoHotkey.

## Avoid blocking tests

A script with `MsgBox` may block until the user closes it.

For automated smoke tests, prefer scripts that write to a log and exit.

Example:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

FileAppend "AHK smoke test OK`n", A_ScriptDir "\ahk_smoke_test.log"
ExitApp
```

## UI automation limitations

AutoHotkey interacts with the active Windows desktop session. WSL can launch the Windows executable, but reliable UI automation depends on:

- A visible active Windows session.
- Correct focus.
- Matching app/window title.
- Display scaling.
- Keyboard layout.
- Admin/elevation level.
- Timing.
- Whether the target app exposes controls.

Prefer testing against Notepad or a disposable test window before using real apps.
