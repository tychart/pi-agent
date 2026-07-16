# Hotkey Examples

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

^!n::Run "notepad.exe"

^!m::{
    MsgBox "Ctrl+Alt+M pressed."
}

Esc::ExitApp
```
