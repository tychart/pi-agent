# Window Management Examples

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force
SetTitleMatchMode 2

^!a::{
    target := "ahk_exe notepad.exe"

    if !WinExist(target) {
        Run "notepad.exe"
        if !WinWait(target, , 3) {
            MsgBox "Could not find or open Notepad."
            return
        }
    }

    WinActivate target
}
```
