# Clipboard Examples

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!c::{
    oldClip := A_Clipboard
    A_Clipboard := ""

    Send "^c"

    if !ClipWait(2) {
        A_Clipboard := oldClip
        MsgBox "Copy failed."
        return
    }

    MsgBox "Copied:`n" A_Clipboard
    A_Clipboard := oldClip
}
```
