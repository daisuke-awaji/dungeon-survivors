#!/bin/sh
# 自動プレイをまとめて回し、結果の行だけを出す。
# 使い方: sh scripts/balance.sh <うまさ> <永続強化レベル> <回数> [キャラクター...]
SKILL=${1:-0.5}; META=${2:-0}; RUNS=${3:-2}; shift 3 2>/dev/null
CHARS=${*:-knight mage thief}
DIR=$(mktemp -d)
for c in $CHARS; do
  i=1
  while [ "$i" -le "$RUNS" ]; do
    node scripts/bot.mjs "$c" "$SKILL" 6 "$META" > "$DIR/$c-$i.log" 2>&1 &
    i=$((i + 1))
  done
done
wait
for f in "$DIR"/*.log; do
  grep -E "^==|結果|被弾|pageerror|240秒|300秒|330秒|360秒" "$f"
done
