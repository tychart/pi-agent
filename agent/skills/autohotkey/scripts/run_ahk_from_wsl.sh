#!/usr/bin/env bash
set -euo pipefail

AHK_EXE="${AHK_EXE:-/mnt/c/Users/tychart/AppData/Local/Programs/AutoHotkey/v2/AutoHotkey64.exe}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-10}"

if [ $# -lt 1 ]; then
  echo "usage: run_ahk_from_wsl.sh path/to/script.ahk [args...]" >&2
  exit 2
fi

SCRIPT="$1"
shift

if [ ! -f "$SCRIPT" ]; then
  echo "script not found: $SCRIPT" >&2
  exit 2
fi

if [ ! -x "$AHK_EXE" ] && [ ! -f "$AHK_EXE" ]; then
  echo "AutoHotkey executable not found: $AHK_EXE" >&2
  exit 2
fi

WIN_SCRIPT="$(wslpath -w "$SCRIPT")"

echo "Running AutoHotkey:"
echo "  exe: $AHK_EXE"
echo "  script: $WIN_SCRIPT"
echo "  timeout: ${TIMEOUT_SECONDS}s"

timeout "${TIMEOUT_SECONDS}s" "$AHK_EXE" "$WIN_SCRIPT" "$@"
code=$?

echo "AutoHotkey exit code: $code"
exit "$code"
