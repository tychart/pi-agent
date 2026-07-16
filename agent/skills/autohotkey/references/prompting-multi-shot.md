# Multi-Shot Prompting Patterns

Use these examples to guide answers across common AHK v2 scenarios.

## Example 1: Launch app hotkey

User:

> Make Ctrl+Alt+N open Notepad.

Answer:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!n::Run "notepad.exe"
```

## Example 2: Safe app activation

User:

> Type hello into Notepad when I press Ctrl+Alt+T.

Answer:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!t::{
    Run "notepad.exe"

    if !WinWait("ahk_exe notepad.exe", , 3) {
        MsgBox "Notepad did not open."
        return
    }

    WinActivate "ahk_exe notepad.exe"

    if !WinWaitActive("ahk_exe notepad.exe", , 3) {
        MsgBox "Notepad did not become active."
        return
    }

    Send "hello{Enter}"
}
```

## Example 3: Clipboard transformation

User:

> Make a hotkey to uppercase selected text.

Answer:

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

    A_Clipboard := StrUpper(A_Clipboard)
    Send "^v"

    Sleep 100
    A_Clipboard := oldClip
}
```

## Example 4: Toggle mode

User:

> Make F8 toggle whether F9 types my email.

Answer:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

enabled := false

F8::{
    global enabled
    enabled := !enabled
    ToolTip enabled ? "Email hotkey enabled" : "Email hotkey disabled"
    SetTimer () => ToolTip(), -1000
}

F9::{
    global enabled
    if !enabled {
        return
    }

    Send "example@example.com"
}
```

## Example 5: Debugging response shape

User:

> This AHK script errors. Fix it.

Answer should:

1. Identify whether it is v1, v2, or mixed.
2. Quote the likely error cause.
3. Provide corrected v2 code.
4. Explain the important changes.
5. Provide a test plan.
