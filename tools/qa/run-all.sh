#!/usr/bin/env bash
# Full verification pass on a fresh production build.
# Runs are sequential on purpose: this container renders in software, and
# concurrent browsers starve each other and produce meaningless timings.
set -u
cd "$(dirname "$0")/../.."
OUT=${1:-qa-shots}
mkdir -p "$OUT"

echo "=== build ==="
npm run build 2>&1 | tail -6 | tee "$OUT/build.log"

for run in \
  "smoke:node tools/qa/smoke.mjs" \
  "smoke-mobile:node tools/qa/smoke.mjs --mobile" \
  "systems:node tools/qa/systems.mjs" \
  "systems-mobile:node tools/qa/systems.mjs --mobile" \
  "bosswalk:node tools/qa/bosswalk.mjs"
do
  name=${run%%:*}
  cmd=${run#*:}
  echo "=== $name ==="
  $cmd > "$OUT/$name.log" 2>&1
  echo "$name exit=$?"
  tail -5 "$OUT/$name.log"
done
echo "=== done ==="
