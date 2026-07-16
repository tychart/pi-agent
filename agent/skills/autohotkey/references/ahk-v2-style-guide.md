# AutoHotkey v2 Style Guide

## Standard header

Use this for most scripts:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force
```

Add these when relevant:

```ahk
Persistent
SetTitleMatchMode 2
CoordMode "Mouse", "Screen"
CoordMode "Pixel", "Screen"
```

Use `Persistent` only when the script needs to stay running but has no hotkeys, GUI, timers, or hooks that already keep it alive.

## General style

Prefer:

- Functions over labels.
- Expression syntax.
- Explicit string quotes.
- Clear variable names.
- Small helper functions.
- Early returns.
- Guard clauses.
- User-configurable constants at the top.
- Comments for customization points.

Avoid:

- v1 command syntax.
- Global variables unless appropriate.
- Hard-coded coordinates unless unavoidable.
- Long sleeps.
- Infinite loops without an emergency stop.
- Destructive operations without confirmation.

## Function style

Prefer:

```ahk
DoThing(param) {
    if !param {
        return false
    }

    ; Work here.
    return true
}
```

Avoid v1-style subroutines for new scripts unless compatibility or simplicity requires them.

## Hotkey style

Single-line hotkey for tiny actions:

```ahk
^!n::Run "notepad.exe"
```

Block hotkey for multi-step actions:

```ahk
^!c::{
    A_Clipboard := ""
    Send "^c"
    if !ClipWait(2) {
        MsgBox "Clipboard copy timed out."
        return
    }
    MsgBox A_Clipboard
}
```

Always use braces for multi-line hotkeys in v2.

## Error handling

Use `try/catch` when a file, process, COM object, or external dependency may fail.

```ahk
try {
    FileAppend "hello`n", "log.txt"
} catch as err {
    MsgBox "Failed: " err.Message
}
```

## Safety

For long-running scripts, include an exit hotkey:

```ahk
Esc::ExitApp
```

For scripts that click/type automatically, add a startup warning or short delay when appropriate:

```ahk
MsgBox "The automation will start after you press OK. Move the mouse to a safe position if needed."
```
