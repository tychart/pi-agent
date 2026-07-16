# AutoHotkey v2 Debugging

## First classify the problem

Determine whether the issue is:

1. Syntax error.
2. v1/v2 syntax mix.
3. Wrong window/app target.
4. Timing problem.
5. Clipboard race condition.
6. Permission/elevation issue.
7. Keyboard layout or focus issue.
8. Path escaping issue.
9. File permission issue.
10. UI automation fragility.

## Common v1-to-v2 mistakes

Watch for:

- `Var = value` instead of `var := "value"`.
- Command syntax where v2 expects functions.
- Unquoted strings.
- Legacy `%var%` dereferencing.
- Label-style subroutines in places where functions are clearer.
- `Clipboard` instead of `A_Clipboard`.
- Old GUI commands.
- Old `IfWinExist`/`IfWinActive` style.
- Old callback or event patterns.

## Add visible debugging

Use:

```ahk
MsgBox "Reached step 1"
ToolTip "Working..."
OutputDebug "debug message"
```

Clear tooltips:

```ahk
SetTimer () => ToolTip(), -1000
```

## Add file logging

```ahk
Log(message) {
    timestamp := FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss")
    FileAppend timestamp " - " message "`n", A_ScriptDir "\debug.log"
}
```

## Clipboard debugging

Use:

```ahk
oldClip := A_Clipboard
A_Clipboard := ""
Send "^c"

if !ClipWait(2) {
    MsgBox "Clipboard timed out."
    A_Clipboard := oldClip
    return
}

MsgBox "Copied: " A_Clipboard
```

## Window debugging

Use:

```ahk
MsgBox "Active window title:`n" WinGetTitle("A")
MsgBox "Active process:`n" WinGetProcessName("A")
```

## Timing debugging

Replace blind sleeps with state waits.

Bad:

```ahk
Sleep 2000
Send "text"
```

Better:

```ahk
if !WinWaitActive("ahk_exe notepad.exe", , 3) {
    MsgBox "Window did not become active."
    return
}
Send "text"
```

## Permission debugging

If a target app runs elevated/admin, a normal AutoHotkey script may not be able to automate it reliably. Tell the user this may require running AutoHotkey as administrator.
