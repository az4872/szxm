#!/usr/bin/env bash
# tests/run_all.sh — 一条命令出回归报告
# 适用：第13轮任务书 v7_202611132030（2026-11-13 20:30）
# 用法：bash tests/run_all.sh [html]     缺省 /sandbox/workspace/output/index.html
# 输出：只含 PASS/FAIL 与关键数字，明细超长时截断；退出码 = 失败项数
set -u
H="${1:-/sandbox/workspace/output/index.html}"
D="$(cd "$(dirname "$0")" && pwd)"
F=0
line(){ printf '%s\n' "$*"; }
# ---- F-4 产物三处自证（原始输出，不改写）----
line "== run_all · 第13轮任务书 v7_202611132030 · $(TZ=Asia/Shanghai date +%Y%m%d%H%M) =="
line "[ART] $(ls -l "$H" | awk '{print $5" B"}' )  $(TZ=Asia/Shanghai stat -c %y "$H" | cut -c1-16)"
line "[MD5] $(md5sum "$H" | awk '{print $1}')"
line "[VER] $(grep -o 'verTag"><b>[^<]*</b>[^<]*' "$H" | head -1 | sed 's/.*<b>//;s/<\/b>//')"
run(){ # $1=脚本 $2=提取结果行的正则 $3=标签
  local out rc; out="$(node "$D/$1" "$H" 2>&1)"; rc=$?
  line "$(printf '%-9s %s' "$3" "$(printf '%s' "$out" | grep -E "$2" | tail -1 | sed 's/^[[:space:]]*//')")"
  printf '%s' "$out" | grep -E '^(FAIL|DIFF|  FAIL)' | sed 's/^/  └ /' | head -6
  [ $rc -ne 0 ] && F=$((F+1)); return 0
}
run test_levels.js '^结果：' 'LEVELS'
run test_v13.js    '^结果：' 'V13'
run test_manual.js '^结果：' 'MANUAL'
run test_trips.js  '^结果：' 'TRIPS'
run run_regress.js '^结果：' 'R-1~R-6'
# ---- 关键数字汇总（六关逐关分）----
line "[六关] $(node "$D/test_levels.js" "$H" 2>/dev/null | grep -oE '^PASS L0[1-6] \| [A-Za-z]+ \| [0-9]+/[0-9]+ \| [0-9.]+% \| [0-9]+ \| [0-9]+' | awk -F'|' '{gsub(/^PASS /,"",$1); printf "%s=%s ", $1, $6}' | sed 's/ $//')"
line "== 汇总：$F 个脚本未全绿（0 = 全绿）=="
exit $F
