# One-Shot Prompting Pattern

Use this as the ideal shape for simple AHK v2 generation.

## User request

> Create an AutoHotkey v2 hotkey that copies selected text, wraps it in quotes, and pastes it back.

## Good response pattern

- Briefly state the approach.
- Provide complete v2 code.
- Include `#Requires AutoHotkey v2.0`.
- Preserve the original clipboard when possible.
- Use `ClipWait`.
- Include test steps.

## Example answer

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!q::{
    oldClip := A_Clipboard
    A_Clipboard := ""

    Send "^c"

    if !ClipWait(2) {
        A_Clipboard := oldClip
        MsgBox "Copy timed out."
        return
    }

    selected := A_Clipboard
    A_Clipboard := '"' selected '"'
    Send "^v"

    Sleep 100
    A_Clipboard := oldClip
}
```

## Explanation

This example demonstrates:

- v2 hotkey block syntax.
- Clipboard clearing before copy.
- `ClipWait`.
- Clipboard restoration.
- Simple, complete, runnable script.
