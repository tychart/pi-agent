# AutoHotkey v2 Basics

## Common directives

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force
```

## Variables and strings

Use expression syntax:

```ahk
name := "Tyler"
count := 3
message := "Hello, " name
```

## Clipboard

Use `A_Clipboard` in v2:

```ahk
A_Clipboard := ""
Send "^c"

if !ClipWait(2) {
    MsgBox "Copy timed out."
    return
}

text := A_Clipboard
```

## Sending keys

Basic:

```ahk
Send "hello"
Send "{Enter}"
Send "^c"
Send "!{Tab}"
```

Prefer explicit app/window activation before sending keys.

## Running programs

```ahk
Run "notepad.exe"
Run "C:\Windows\System32\calc.exe"
```

## Waiting for windows

Use waits instead of blind sleeps:

```ahk
Run "notepad.exe"
if !WinWait("ahk_exe notepad.exe", , 3) {
    MsgBox "Notepad did not open."
    return
}
WinActivate "ahk_exe notepad.exe"
WinWaitActive "ahk_exe notepad.exe"
```

## Files

```ahk
FileAppend "line one`n", "output.txt"

if FileExist("output.txt") {
    text := FileRead("output.txt")
}
```

## Objects, arrays, maps

Array:

```ahk
items := ["one", "two", "three"]
for item in items {
    MsgBox item
}
```

Map:

```ahk
settings := Map()
settings["delay"] := 500
settings["name"] := "demo"
```

## Timers

```ahk
SetTimer CheckSomething, 1000

CheckSomething() {
    ToolTip A_Now
}
```

## GUIs

Use v2 object-style GUI code:

```ahk
myGui := Gui()
myGui.AddText(, "Hello")
myGui.AddButton(, "OK").OnEvent("Click", (*) => myGui.Destroy())
myGui.Show()
```

Verify GUI syntax against docs before generating complex GUIs.
