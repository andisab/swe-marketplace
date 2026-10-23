#!/usr/bin/env bash
# run-phase.sh — Parallel dispatch orchestrator for the adv plugin
# Handles parallel dispatch, validation, and fallback for review and cross-exam phases.
# Outputs a JSON summary to stdout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCH="$SCRIPT_DIR/dispatch.sh"
PROMPTS_DIR="$SCRIPT_DIR/../prompts"

# --- Defaults ---
PHASE=""
ASSIGNMENTS=""
PROMPT_DIR=""
OUTPUT_DIR=""
TIMEOUT=300
GEMINI_FALLBACK_MODEL="${ADV_GEMINI_FALLBACK_MODEL:-gemini-3-flash-preview}"
ROUND=""
GEMINI_MODEL=""
CODEX_REVIEW_SCOPE=""

usage() {
  cat <<'EOF'
Usage: run-phase.sh --phase <review|cross-exam> --assignments <spec> [OPTIONS]

Options:
  --phase <review|cross-exam>   Required. Phase type.
  --assignments <spec>          Required. Engine assignments.
                                 Review:     "quality:codex,implementation:gemini,testing:codex,documentation:gemini"
                                 Cross-exam: "codex,gemini" (just engine names)
  --prompt-dir <path>           Directory containing prepared prompt files
  --output-dir <path>           Directory for output files
  --timeout <seconds>           Timeout per dispatch (default: 300)
  --round <N>                   Cross-exam round number (required for cross-exam phase)
  --gemini-model <model>        Override Gemini model (default: the CLI's own; on quota adv retries on
                                ADV_GEMINI_FALLBACK_MODEL, gemini-3-flash-preview unless set)
  --codex-review <scope>        Review phase only: run the Codex reviewers in `codex review` mode. <scope> is
                                the sentence that names the git scope (preflight's scope.codex_review); it
                                replaces the diff in those reviewers' prompts, and Codex reads the changes itself.
                                A reviewer that falls back to Claude uses the prompt-dir file (the diff) instead.
  -h, --help                    Show this help

Review phase expects:   prompt-dir/prompt-<reviewer>.md
                        Writes: output-dir/findings-<reviewer>.md

Cross-exam phase expects: prompt-dir/prompt-xr<N>.md
                          Writes: output-dir/xr<N>-<engine>.md
EOF
  exit 1
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)         PHASE="$2"; shift 2 ;;
    --assignments)   ASSIGNMENTS="$2"; shift 2 ;;
    --prompt-dir)    PROMPT_DIR="$2"; shift 2 ;;
    --output-dir)    OUTPUT_DIR="$2"; shift 2 ;;
    --timeout)       TIMEOUT="$2"; shift 2 ;;
    --round)         ROUND="$2"; shift 2 ;;
    --gemini-model)  GEMINI_MODEL="$2"; shift 2 ;;
    --codex-review)  CODEX_REVIEW_SCOPE="$2"; shift 2 ;;
    -h|--help)       usage ;;
    *)               echo "ERROR: Unknown argument: $1" >&2; usage ;;
  esac
done

# --- Validation ---
if [[ -z "$PHASE" ]]; then echo "ERROR: --phase is required" >&2; usage; fi
if [[ -z "$ASSIGNMENTS" ]]; then echo "ERROR: --assignments is required" >&2; usage; fi
if [[ -z "$PROMPT_DIR" ]]; then echo "ERROR: --prompt-dir is required" >&2; usage; fi
if [[ -z "$OUTPUT_DIR" ]]; then echo "ERROR: --output-dir is required" >&2; usage; fi
if [[ "$PHASE" == "cross-exam" && -z "$ROUND" ]]; then echo "ERROR: --round is required for cross-exam phase" >&2; usage; fi
# "engine_default" is the placeholder older preflight output used for "no model"; never pass it to the CLI
if [[ "$GEMINI_MODEL" == "engine_default" ]]; then GEMINI_MODEL=""; fi

mkdir -p "$OUTPUT_DIR"

# ============================================================
# REVIEW PHASE
# ============================================================
run_review_phase() {
  local pids=()
  local reviewers=()
  local engines=()

  # Parse assignments: "quality:codex,implementation:gemini,..."
  IFS=',' read -ra pairs <<< "$ASSIGNMENTS"
  for pair in "${pairs[@]}"; do
    local reviewer="${pair%%:*}"
    local engine="${pair##*:}"
    reviewers+=("$reviewer")
    engines+=("$engine")
  done

  # Dispatch all reviewers in parallel. Each dispatch's status line goes to status-<reviewer>.json,
  # so the summary can report the model and tokens; a fallback overwrites it.
  for i in "${!reviewers[@]}"; do
    local reviewer="${reviewers[$i]}"
    local engine="${engines[$i]}"
    local prompt_file="$PROMPT_DIR/prompt-${reviewer}.md"
    local output_file="$OUTPUT_DIR/findings-${reviewer}.md"
    local status_file="$OUTPUT_DIR/status-${reviewer}.json"
    local model_args=()

    if [[ -n "$GEMINI_MODEL" && "$engine" == "gemini" ]]; then
      model_args=(--model "$GEMINI_MODEL")
    fi

    if [[ ! -f "$prompt_file" ]]; then
      echo "DISPATCH_ERROR: engine=$engine exit_code=1 error_type=general model=none duration_ms=0" > "$output_file"
      echo "WARN: Prompt file not found: $prompt_file" >&2
      continue
    fi

    if [[ -n "$CODEX_REVIEW_SCOPE" && "$engine" == "codex" ]]; then
      # Review mode: the template with the scope sentence in place of the diff; Codex runs git itself
      local template="$PROMPTS_DIR/reviewer-${reviewer}.md"
      if [[ -f "$template" ]]; then
        local review_prompt="$OUTPUT_DIR/prompt-${reviewer}.codex-review.md"
        local tpl
        tpl="$(cat "$template")"
        printf '%s\n' "${tpl//\{SCOPE_CONTENT\}/$CODEX_REVIEW_SCOPE}" > "$review_prompt"
        bash "$DISPATCH" --engine codex --codex-review \
          --prompt-file "$review_prompt" \
          --output-file "$output_file" \
          --cwd "." \
          --timeout "$TIMEOUT" \
          ${model_args[@]+"${model_args[@]}"} > "$status_file" &
        pids+=($!)
        continue
      fi
      echo "WARN: No template for $reviewer at $template; using the prepared prompt with codex exec" >&2
    fi

    bash "$DISPATCH" --engine "$engine" \
      --prompt-file "$prompt_file" \
      --output-file "$output_file" \
      --cwd "." \
      --timeout "$TIMEOUT" \
      ${model_args[@]+"${model_args[@]}"} > "$status_file" &
    pids+=($!)
  done

  # Wait for all dispatches
  local exit_codes=()
  for pid in "${pids[@]}"; do
    wait "$pid" && exit_codes+=(0) || exit_codes+=($?)
  done

  # Validate and handle fallbacks
  local results_json="{}"
  local success_count=0
  local failed_list=""
  local tokens_in=0
  local tokens_out=0

  for i in "${!reviewers[@]}"; do
    local reviewer="${reviewers[$i]}"
    local engine="${engines[$i]}"
    local output_file="$OUTPUT_DIR/findings-${reviewer}.md"
    local status_file="$OUTPUT_DIR/status-${reviewer}.json"
    local status="success"
    local fallback_used=false

    # No output file means the dispatch never ran (a crash before it wrote anything): treat it as a failure, not a success
    if [[ ! -f "$output_file" ]]; then
      echo "DISPATCH_ERROR: engine=$engine exit_code=1 error_type=general model=none duration_ms=0" > "$output_file"
    fi

    if head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
      local error_line
      error_line=$(head -1 "$output_file")
      local error_type
      error_type=$(echo "$error_line" | grep -oE 'error_type=[^ ]+' | cut -d= -f2)
      local orig_model
      orig_model=$(echo "$error_line" | grep -oE 'model=[^ ]+' | cut -d= -f2)

      # Quota exhausted, or the model is gone: retry Gemini on the cheaper fallback model
      if [[ "$engine" == "gemini" && ( "$error_type" == "quota" || "$error_type" == "model_not_found" ) && "$orig_model" != "$GEMINI_FALLBACK_MODEL" ]]; then
        bash "$DISPATCH" --engine gemini --model "$GEMINI_FALLBACK_MODEL" \
          --prompt-file "$PROMPT_DIR/prompt-${reviewer}.md" \
          --output-file "$output_file" \
          --cwd "." --timeout "$TIMEOUT" > "$status_file" 2>/dev/null || true
      fi

      # If still failed, fall back to Claude (on the prompt-dir prompt, which carries the diff)
      if head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
        bash "$DISPATCH" --engine claude \
          --prompt-file "$PROMPT_DIR/prompt-${reviewer}.md" \
          --output-file "$output_file" \
          --cwd "." --timeout "$TIMEOUT" > "$status_file" 2>/dev/null || true
        fallback_used=true
        engine="claude"
      fi

      # Final check
      if head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
        status="failed"
        failed_list="${failed_list:+$failed_list,}$reviewer"
      fi
    fi

    if [[ "$status" == "success" ]]; then
      success_count=$((success_count + 1))
    fi

    local st
    st="$(tail -1 "$status_file" 2>/dev/null || true)"
    if ! printf '%s' "$st" | jq -e 'type == "object"' >/dev/null 2>&1; then st='{}'; fi
    results_json="$(jq -c --arg r "$reviewer" --arg e "$engine" --arg s "$status" --argjson f "$fallback_used" --argjson st "$st" \
      '.[$r] = {engine: $e, status: $s, fallback_used: $f, model_used: ($st.model_used // "unknown"),
                tokens_in: ($st.tokens_in // 0), tokens_out: ($st.tokens_out // 0), duration_ms: ($st.duration_ms // 0)}' <<< "$results_json")"
    tokens_in=$((tokens_in + $(jq -r '.tokens_in // 0' <<< "$st")))
    tokens_out=$((tokens_out + $(jq -r '.tokens_out // 0' <<< "$st")))
  done

  # Output final JSON
  jq -nc \
    --arg phase "review" \
    --argjson results "$results_json" \
    --argjson success_count "$success_count" \
    --arg failed "$failed_list" \
    --argjson tokens_in "$tokens_in" \
    --argjson tokens_out "$tokens_out" \
    '{phase: $phase, results: $results, success_count: $success_count, failed: ($failed | split(",") | map(select(. != ""))), tokens: {in: $tokens_in, out: $tokens_out}}'
}

# ============================================================
# CROSS-EXAM PHASE
# ============================================================
run_cross_exam_phase() {
  local pids=()
  local engines_list=()

  # Parse assignments: "codex,gemini" (just engine names)
  IFS=',' read -ra engines_list <<< "$ASSIGNMENTS"

  local prompt_file="$PROMPT_DIR/prompt-xr${ROUND}.md"

  if [[ ! -f "$prompt_file" ]]; then
    echo "ERROR: Cross-exam prompt not found: $prompt_file" >&2
    jq -nc \
      --arg phase "cross-exam" \
      --argjson round "$ROUND" \
      '{phase: $phase, round: $round, results: {}, success_count: 0, failed: [], error: "prompt_not_found"}'
    exit 1
  fi

  # Dispatch to each engine in parallel; each status line goes to status-xr<N>-<engine>.json
  for engine in "${engines_list[@]}"; do
    local output_file="$OUTPUT_DIR/xr${ROUND}-${engine}.md"
    local model_args=()

    if [[ -n "$GEMINI_MODEL" && "$engine" == "gemini" ]]; then
      model_args=(--model "$GEMINI_MODEL")
    fi

    bash "$DISPATCH" --engine "$engine" \
      --prompt-file "$prompt_file" \
      --output-file "$output_file" \
      --cwd "." \
      --timeout "$TIMEOUT" \
      ${model_args[@]+"${model_args[@]}"} > "$OUTPUT_DIR/status-xr${ROUND}-${engine}.json" &
    pids+=($!)
  done

  # Wait for all
  local exit_codes=()
  for pid in "${pids[@]}"; do
    wait "$pid" && exit_codes+=(0) || exit_codes+=($?)
  done

  # Collect results
  local results_json="{}"
  local success_count=0
  local failed_list=""
  local tokens_in=0
  local tokens_out=0
  local validate_count=0
  local dispute_count=0
  local amend_count=0
  local new_finding_count=0

  for engine in "${engines_list[@]}"; do
    local output_file="$OUTPUT_DIR/xr${ROUND}-${engine}.md"
    local status="success"

    if [[ ! -f "$output_file" ]] || head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
      status="failed"
      failed_list="${failed_list:+$failed_list,}$engine"
    else
      success_count=$((success_count + 1))
      # Count verdicts
      if [[ -f "$output_file" ]]; then
        # grep -c prints 0 and exits 1 when nothing matches; `|| echo 0` here would add a second 0 and break the arithmetic
        validate_count=$((validate_count + $(grep -ci 'VALIDATE' "$output_file" 2>/dev/null || true)))
        dispute_count=$((dispute_count + $(grep -ci 'DISPUTE' "$output_file" 2>/dev/null || true)))
        amend_count=$((amend_count + $(grep -ci 'AMEND' "$output_file" 2>/dev/null || true)))
        new_finding_count=$((new_finding_count + $(grep -c 'New Finding' "$output_file" 2>/dev/null || true)))
      fi
    fi

    local st
    st="$(tail -1 "$OUTPUT_DIR/status-xr${ROUND}-${engine}.json" 2>/dev/null || true)"
    if ! printf '%s' "$st" | jq -e 'type == "object"' >/dev/null 2>&1; then st='{}'; fi
    results_json="$(jq -c --arg e "$engine" --arg s "$status" --argjson st "$st" \
      '.[$e] = {status: $s, model_used: ($st.model_used // "unknown"), tokens_in: ($st.tokens_in // 0),
                tokens_out: ($st.tokens_out // 0), duration_ms: ($st.duration_ms // 0)}' <<< "$results_json")"
    tokens_in=$((tokens_in + $(jq -r '.tokens_in // 0' <<< "$st")))
    tokens_out=$((tokens_out + $(jq -r '.tokens_out // 0' <<< "$st")))
  done

  jq -nc \
    --arg phase "cross-exam" \
    --argjson round "$ROUND" \
    --argjson results "$results_json" \
    --argjson success_count "$success_count" \
    --arg failed "$failed_list" \
    --argjson tokens_in "$tokens_in" \
    --argjson tokens_out "$tokens_out" \
    --argjson validate_count "$validate_count" \
    --argjson dispute_count "$dispute_count" \
    --argjson amend_count "$amend_count" \
    --argjson new_finding_count "$new_finding_count" \
    '{
      phase: $phase,
      round: $round,
      results: $results,
      success_count: $success_count,
      failed: ($failed | split(",") | map(select(. != ""))),
      tokens: {in: $tokens_in, out: $tokens_out},
      verdicts: {validate: $validate_count, dispute: $dispute_count, amend: $amend_count, new_findings: $new_finding_count}
    }'
}

# ============================================================
# DISPATCH TO PHASE
# ============================================================
case "$PHASE" in
  review)     run_review_phase ;;
  cross-exam) run_cross_exam_phase ;;
  *)          echo "ERROR: Unknown phase: $PHASE" >&2; usage ;;
esac
