# File and Text Automation Examples

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

logPath := A_ScriptDir "\example.log"

Log("Script started.")

Log(message) {
    global logPath
    timestamp := FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss")
    FileAppend timestamp " - " message "`n", logPath
}
```
