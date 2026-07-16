#Requires AutoHotkey v2.0
#SingleInstance Force

logPath := A_ScriptDir "\ahk_smoke_test.log"
FileAppend "AHK smoke test OK at " FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss") "`n", logPath
ExitApp
