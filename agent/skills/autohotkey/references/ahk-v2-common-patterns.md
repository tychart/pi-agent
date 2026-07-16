# AutoHotkey v2 Common Patterns

## Hotkey launches app

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!n::Run "notepad.exe"
```

## Hotkey copies selected text and transforms it

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!u::{
    oldClip := A_Clipboard
    A_Clipboard := ""

    Send "^c"

    if !ClipWait(2) {
        A_Clipboard := oldClip
        MsgBox "Copy timed out."
        return
    }

    text := StrUpper(A_Clipboard)
    A_Clipboard := text
    Send "^v"
}
```

## Safe window activation

```ahk
ActivateWindow(winTitle, timeoutSeconds := 3) {
    if !WinWait(winTitle, , timeoutSeconds) {
        MsgBox "Window not found: " winTitle
        return false
    }

    WinActivate winTitle

    if !WinWaitActive(winTitle, , timeoutSeconds) {
        MsgBox "Window did not become active: " winTitle
        return false
    }

    return true
}
```

## App-specific automation pattern

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

target := "ahk_exe notepad.exe"

^!t::{
    if !ActivateWindow(target) {
        return
    }

    Send "Automated text{Enter}"
}

ActivateWindow(winTitle, timeoutSeconds := 3) {
    if !WinWait(winTitle, , timeoutSeconds) {
        MsgBox "Window not found: " winTitle
        return false
    }

    WinActivate winTitle

    if !WinWaitActive(winTitle, , timeoutSeconds) {
        MsgBox "Window did not become active: " winTitle
        return false
    }

    return true
}
```

## Logging pattern

```ahk
Log(message) {
    timestamp := FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss")
    FileAppend timestamp " - " message "`n", A_ScriptDir "\script.log"
}
```

## Toggle pattern

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

enabled := false

^!s::{
    global enabled
    enabled := !enabled
    ToolTip enabled ? "Enabled" : "Disabled"
    SetTimer () => ToolTip(), -1000
}
```

## Emergency stop

```ahk
Esc::ExitApp
```

## Coordinate automation warning

Use coordinates only when control/window automation is not feasible. If using coordinates:

- Set `CoordMode`.
- Explain screen scaling issues.
- Add a delay before starting.
- Add `Esc::ExitApp`.
- Prefer user-configurable variables.

```ahk
CoordMode "Mouse", "Screen"
Esc::ExitApp
```
