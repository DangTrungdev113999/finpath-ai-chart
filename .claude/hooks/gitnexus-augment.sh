#!/usr/bin/env bash
# PreToolUse hook for Grep|Glob — enriches search patterns with GitNexus graph context.
# Feeds output back to Claude via hookSpecificOutput.additionalContext.
# Silent when pattern is empty or graph has no match (never blocks the tool call).

input=$(cat)
pattern=$(printf '%s' "$input" | jq -r '.tool_input.pattern // empty')
[ -z "$pattern" ] && exit 0

ctx=$(npx gitnexus augment "$pattern" 2>&1 | grep -v '^npm warn' | grep -v '^$' || true)
[ -z "$ctx" ] && exit 0
case "$ctx" in *'0 related symbols found'*) exit 0 ;; esac

printf '%s' "$ctx" | jq -Rs --arg p "$pattern" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:("[GitNexus augment: " + $p + "]\n" + .)}}'
