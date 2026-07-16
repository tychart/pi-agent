# AutoHotkey v1 to v2 Migration

## Rule

When converting v1 to v2, do not do a superficial edit. Identify all v1 idioms and rewrite to idiomatic v2.

## Common conversions

### Header

Prefer:

```ahk
#Requires AutoHotkey v2.0
#SingleInstance Force
```

### Assignments

v1:

```ahk
name = Tyler
```

v2:

```ahk
name := "Tyler"
```

### Clipboard

v1:

```ahk
Clipboard := ""
Send ^c
ClipWait, 2
text := Clipboard
```

v2:

```ahk
A_Clipboard := ""
Send "^c"

if !ClipWait(2) {
    MsgBox "Copy timed out."
    return
}

text := A_Clipboard
```

### Commands to functions

v1 often uses command syntax:

```ahk
WinActivate, Untitled - Notepad
```

v2 uses function/expression-style syntax:

```ahk
WinActivate "Untitled - Notepad"
```

### Hotkeys

v2 multi-line hotkeys should use braces:

```ahk
^!x::{
    MsgBox "Hello"
}
```

### GUI

v1 GUI command patterns should be rewritten to v2 object-style GUI patterns. Verify complex GUI migrations against current docs.

## Migration workflow

1. Identify v1-only constructs.
2. Convert syntax.
3. Preserve behavior.
4. Add `#Requires AutoHotkey v2.0`.
5. Replace fragile patterns with robust v2 alternatives.
6. Add test notes.
7. Warn about any behavior that could not be confidently preserved.
