#!/bin/bash
set -e

OUTPUT_DIR="server/atlas/data"
OUTPUT_FILE="$OUTPUT_DIR/git-snapshot.json"

mkdir -p "$OUTPUT_DIR"

echo "Capturing git metrics..."

TOTAL_COMMITS=$(git rev-list --count HEAD 2>/dev/null || echo "0")
COMMITS_TODAY=$(git rev-list --count --since="midnight" HEAD 2>/dev/null || echo "0")
COMMITS_WEEK=$(git rev-list --count --since="1 week ago" HEAD 2>/dev/null || echo "0")
COMMITS_MONTH=$(git rev-list --count --since="1 month ago" HEAD 2>/dev/null || echo "0")
CONTRIBUTORS=$(git shortlog -sn HEAD 2>/dev/null | wc -l | tr -d ' ')
BRANCHES=$(git branch -r 2>/dev/null | wc -l | tr -d ' ')

DIFF_STAT=$(git diff --stat HEAD~10 HEAD 2>/dev/null | tail -1 || echo "0 files")
LINES_ADDED=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | head -1 || echo "0")
LINES_REMOVED=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' | head -1 || echo "0")

LINES_ADDED=${LINES_ADDED:-0}
LINES_REMOVED=${LINES_REMOVED:-0}

FILES_CREATED=$(git diff --name-status HEAD~10 HEAD 2>/dev/null | grep "^A" | wc -l | tr -d ' ')
FILES_MODIFIED=$(git diff --name-status HEAD~10 HEAD 2>/dev/null | grep "^M" | wc -l | tr -d ' ')
FILES_DELETED=$(git diff --name-status HEAD~10 HEAD 2>/dev/null | grep "^D" | wc -l | tr -d ' ')

FILES_CREATED=${FILES_CREATED:-0}
FILES_MODIFIED=${FILES_MODIFIED:-0}
FILES_DELETED=${FILES_DELETED:-0}

# Count lines using git ls-files (comprehensive count)
TS_LINES=$(git ls-files '*.ts' '*.tsx' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
JS_LINES=$(git ls-files '*.js' '*.jsx' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
CSS_LINES=$(git ls-files '*.css' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
JSON_LINES=$(git ls-files '*.json' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
SOL_LINES=$(git ls-files '*.sol' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
HTML_LINES=$(git ls-files '*.html' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
SH_LINES=$(git ls-files '*.sh' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
TS_LINES=${TS_LINES:-0}
JS_LINES=${JS_LINES:-0}
CSS_LINES=${CSS_LINES:-0}
JSON_LINES=${JSON_LINES:-0}
SOL_LINES=${SOL_LINES:-0}
HTML_LINES=${HTML_LINES:-0}
SH_LINES=${SH_LINES:-0}
TOTAL_LINES=$((TS_LINES + JS_LINES + CSS_LINES + JSON_LINES + SOL_LINES + HTML_LINES + SH_LINES))
CODE_LINES=$((TS_LINES + JS_LINES + CSS_LINES + SOL_LINES + HTML_LINES + SH_LINES))

# Build size metrics (in MB with one decimal, using awk for portability)
CLIENT_SIZE_BYTES=$(du -sb dist/client/assets/ 2>/dev/null | cut -f1)
CLIENT_SIZE_BYTES=${CLIENT_SIZE_BYTES:-0}
DIST_SIZE_BYTES=$(du -sb dist/client/ 2>/dev/null | cut -f1)
DIST_SIZE_BYTES=${DIST_SIZE_BYTES:-0}
CLIENT_SIZE_MB=$(echo "$CLIENT_SIZE_BYTES" | awk '{printf "%.1f", $1 / 1048576}')
DIST_SIZE_MB=$(echo "$DIST_SIZE_BYTES" | awk '{printf "%.1f", $1 / 1048576}')

HEALTH_SCORE=100
CAPTURED_AT=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
TOTAL_K=$((TOTAL_LINES / 1000))

CODE_K=$((CODE_LINES / 1000))

cat > "$OUTPUT_FILE" << EOF
{
  "capturedAt": "$CAPTURED_AT",
  "commits": {
    "today": $COMMITS_TODAY,
    "thisWeek": $COMMITS_WEEK,
    "thisMonth": $COMMITS_MONTH,
    "total": $TOTAL_COMMITS
  },
  "linesOfCode": {
    "typescript": $TS_LINES,
    "javascript": $JS_LINES,
    "css": $CSS_LINES,
    "json": $JSON_LINES,
    "solidity": $SOL_LINES,
    "html": $HTML_LINES,
    "shell": $SH_LINES,
    "code": $CODE_LINES,
    "total": $TOTAL_LINES,
    "added": $LINES_ADDED,
    "removed": $LINES_REMOVED,
    "net": $((LINES_ADDED - LINES_REMOVED))
  },
  "files": {
    "created": $FILES_CREATED,
    "modified": $FILES_MODIFIED,
    "deleted": $FILES_DELETED
  },
  "buildSize": {
    "clientMB": $CLIENT_SIZE_MB,
    "totalMB": $DIST_SIZE_MB
  },
  "contributors": $CONTRIBUTORS,
  "branches": $BRANCHES,
  "healthScore": $HEALTH_SCORE,
  "narrative": "Production snapshot: $TOTAL_COMMITS commits, ${TOTAL_K}K total lines (${CODE_K}K code) across $CONTRIBUTORS contributors."
}
EOF

echo "Git snapshot captured:"
cat "$OUTPUT_FILE"
