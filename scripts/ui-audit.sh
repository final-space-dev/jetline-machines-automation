#!/usr/bin/env bash
# The UI gate (docs/specs/ui.md "Rules the gate enforces"). Scope: .tsx under
# src/app and src/components (the system's own layer is src/components/machines); the pulled kit in src/components/ui is exempt. Exit 1 on any hit.
set -euo pipefail
cd "$(dirname "$0")/.."

FILES=()
while IFS= read -r f; do FILES+=("$f"); done < <(find src/app src/components -name '*.tsx' -not -path 'src/components/ui/*' 2>/dev/null | sort)
[ ${#FILES[@]} -gt 0 ] || { echo "ui-audit: no files in scope"; exit 1; }

# PCRE matching: grep -P where grep has it (GNU grep on the box), perl's identical engine otherwise (BSD grep on a Mac).
if echo x | grep -qP 'x(?=$)' 2>/dev/null; then
  pcre() { grep -HnP -- "$1" "${@:2}" || true; }
else
  pcre() { perl -ne 'BEGIN { $p = shift } print "$ARGV:$.:$_" if /$p/; close ARGV if eof' "$1" "${@:2}"; }
fi

FAILED=0
# check NAME PATTERN [EXEMPT_PATH_REGEX]
check() {
  local name=$1 pattern=$2 exempt=${3:-}
  local hits
  hits=$(pcre "$pattern" "${FILES[@]}" | { if [ -n "$exempt" ]; then grep -Ev "^($exempt):" || true; else cat; fi; })
  if [ -n "$hits" ]; then
    FAILED=1
    echo "✗ $name"
    echo "$hits" | sed 's/^/    /'
  fi
}

check 'raw table' '<table\b|@/components/ui/table' 'src/components/machines/data-table\.tsx'
check 'svg outside logo.tsx' '<svg\b' '[^:]*/logo\.tsx'
check 'native select' '<select\b'
check 'native checkbox' '<input\b[^>]*type=["'"'"'{]*checkbox'
check 'native date/time input' 'type=["'"'"'{]*(date|datetime-local|month|week|time)["'"'"'}]'
check 'native file input' '<input\b[^>]*type=["'"'"'{]*file' 'src/components/machines/file-picker\.tsx'
check 'bare <button> (use the kit Button)' '<button(?![^>]*type="submit")'
check 'role="switch" (use the kit Switch)' 'role=["'"'"']switch'
check 'animate-spin (use the kit Spinner)' '\banimate-spin\b'
check 'hex colour' '(?<![\w&/])#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})\b'
check 'oklch() literal' 'oklch\('
check 'Tailwind palette class' '\b(?:bg|text|border|ring|outline|divide|fill|stroke|from|via|to|shadow|accent|caret|decoration|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b'
check 'arbitrary px size' '\b(?:min-|max-)?(?:w|h|size|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?)-\[\d+(?:\.\d+)?px\]'
check 'inline style' 'style=\{\{'
check 'description prop / CardDescription' '\bdescription=|<CardDescription\b' 'src/components/machines/empty\.tsx'

# A DataGrid within 8 lines after `.map(… => (` is a grid per row: one kind of thing belongs in one table.
grid_hits=$(awk '
  FNR == 1 { mapline = -100 }
  /\.map\(.*=>[[:space:]]*\(/ { mapline = FNR }
  /<DataGrid([^A-Za-z0-9_]|$)/ && FNR - mapline <= 8 { print FILENAME ":" FNR ":" $0 }
' "${FILES[@]}")
if [ -n "$grid_hits" ]; then
  FAILED=1
  echo "✗ DataGrid inside .map()"
  echo "$grid_hits" | sed 's/^/    /'
fi

if [ "$FAILED" -ne 0 ]; then
  echo "ui-audit: failed"
  exit 1
fi
echo "ui-audit: ${#FILES[@]} files clean"
