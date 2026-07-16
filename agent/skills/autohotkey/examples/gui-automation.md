# GUI Automation Examples

Verify complex GUI syntax against the current AutoHotkey v2 docs before generating final code.

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force

myGui := Gui()
myGui.Title := "Demo"
myGui.AddText(, "Enter text:")
edit := myGui.AddEdit("w300")
myGui.AddButton(, "Show").OnEvent("Click", (*) => MsgBox(edit.Value))
myGui.Show()
```
