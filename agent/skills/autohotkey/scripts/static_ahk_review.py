#!/usr/bin/env python3
"""
Lightweight static review helper for AutoHotkey scripts.

This is not a full parser. It catches common v1/v2 mixups and safety issues
before the agent suggests running a script.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


V1_PATTERNS = [
    (re.compile(r"^\s*IfWinExist\b", re.I), "possible v1 IfWinExist; prefer WinExist()/WinWait() in v2"),
    (re.compile(r"^\s*IfWinActive\b", re.I), "possible v1 IfWinActive; prefer WinActive()/WinWaitActive() in v2"),
    (re.compile(r"^\s*StringReplace\b", re.I), "possible v1 StringReplace command"),
    (re.compile(r"^\s*Gui,\s*", re.I), "possible v1 Gui command syntax"),
    (re.compile(r"^\s*ControlClick,\s*", re.I), "possible v1 ControlClick command syntax"),
    (re.compile(r"^\s*WinActivate,\s*", re.I), "possible v1 WinActivate command syntax"),
    (re.compile(r"^\s*Send,\s*", re.I), "possible v1 Send command syntax"),
    (re.compile(r"^\s*Sleep,\s*", re.I), "possible v1 Sleep command syntax"),
    (re.compile(r"\bClipboard\b"), "possible v1 Clipboard variable; v2 usually uses A_Clipboard"),
]

SAFETY_PATTERNS = [
    (re.compile(r"\bFileDelete\b", re.I), "destructive file deletion"),
    (re.compile(r"\bRegWrite\b", re.I), "registry modification"),
    (re.compile(r"\bRegDelete\b", re.I), "registry deletion"),
    (re.compile(r"\bShutdown\b", re.I), "shutdown/logoff action"),
    (re.compile(r"\bClick\b", re.I), "mouse clicking"),
    (re.compile(r"\bSend\b", re.I), "keystroke sending"),
]


def review(path: Path) -> int:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    findings: list[str] = []

    if "#Requires AutoHotkey v2" not in text:
        findings.append("missing '#Requires AutoHotkey v2.0' directive")

    for i, line in enumerate(lines, start=1):
        for pattern, message in V1_PATTERNS:
            if pattern.search(line):
                findings.append(f"line {i}: {message}: {line.strip()}")

    safety_findings = []
    for i, line in enumerate(lines, start=1):
        for pattern, message in SAFETY_PATTERNS:
            if pattern.search(line):
                safety_findings.append(f"line {i}: {message}: {line.strip()}")

    print(f"Static review: {path}")

    if findings:
        print("\nPotential correctness issues:")
        for item in findings:
            print(f"- {item}")
    else:
        print("\nPotential correctness issues: none found")

    if safety_findings:
        print("\nPotential safety-sensitive operations:")
        for item in safety_findings:
            print(f"- {item}")
    else:
        print("\nPotential safety-sensitive operations: none found")

    return 1 if findings else 0


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: static_ahk_review.py path/to/script.ahk", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])

    if not path.exists():
        print(f"file not found: {path}", file=sys.stderr)
        return 2

    return review(path)


if __name__ == "__main__":
    raise SystemExit(main())
