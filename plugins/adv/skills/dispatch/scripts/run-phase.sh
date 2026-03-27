#!/usr/bin/env bash
# run-phase.sh — Parallel dispatch orchestrator for the adv plugin
# Handles parallel dispatch, validation, and fallback for review and cross-exam phases.
# Outputs a JSON summary to stdout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCH="$SCRIPT_DIR/dispatch.sh"

# --- Defaults ---
PHASE=""
ASSIGNMENTS=""
PROMPT_DIR=""
OUTPUT_DIR=""
TIMEOUT=300
ROUND=""
GEMINI_MODEL=""

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
  --gemini-model <model>        Override Gemini model (e.g., gemini-2.0-flash)
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

  # Dispatch all reviewers in parallel
  for i in "${!reviewers[@]}"; do
    local reviewer="${reviewers[$i]}"
    local engine="${engines[$i]}"
    local prompt_file="$PROMPT_DIR/prompt-${reviewer}.md"
    local output_file="$OUTPUT_DIR/findings-${reviewer}.md"
    local model_args=()

    if [[ -n "$GEMINI_MODEL" && "$engine" == "gemini" ]]; then
      model_args=(--model "$GEMINI_MODEL")
    fi

    if [[ ! -f "$prompt_file" ]]; then
      echo "DISPATCH_ERROR: engine=$engine exit_code=1 error_type=general model=none duration_ms=0" > "$output_file"
      echo "WARN: Prompt file not found: $prompt_file" >&2
      continue
    fi

    bash "$DISPATCH" --engine "$engine" \
      --prompt-file "$prompt_file" \
      --output-file "$output_file" \
      --cwd "." \
      --timeout "$TIMEOUT" \
      "${model_args[@]}" &
    pids+=($!)
  done

  # Wait for all dispatches
  local exit_codes=()
  for pid in "${pids[@]}"; do
    wait "$pid" && exit_codes+=(0) || exit_codes+=($?)
  done

  # Validate and handle fallbacks
  local results_json="{"
  local success_count=0
  local failed_list=""

  for i in "${!reviewers[@]}"; do
    local reviewer="${reviewers[$i]}"
    local engine="${engines[$i]}"
    local output_file="$OUTPUT_DIR/findings-${reviewer}.md"
    local status="success"
    local fallback_used=false

    if [[ -f "$output_file" ]] && head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
      local error_line
      error_line=$(head -1 "$output_file")
      local error_type
      error_type=$(echo "$error_line" | grep -oE 'error_type=[^ ]+' | cut -d= -f2)
      local orig_model
      orig_model=$(echo "$error_line" | grep -oE 'model=[^ ]+' | cut -d= -f2)

      # Gemini quota fallback: try flash model
      if [[ "$engine" == "gemini" && "$error_type" == "quota" && "$orig_model" != "gemini-2.0-flash" ]]; then
        bash "$DISPATCH" --engine gemini --model gemini-2.0-flash \
          --prompt-file "$PROMPT_DIR/prompt-${reviewer}.md" \
          --output-file "$output_file" \
          --cwd "." --timeout "$TIMEOUT" 2>/dev/null || true
      fi

      # If still failed, fall back to Claude
      if head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
        bash "$DISPATCH" --engine claude \
          --prompt-file "$PROMPT_DIR/prompt-${reviewer}.md" \
          --output-file "$output_file" \
          --cwd "." --timeout "$TIMEOUT" 2>/dev/null || true
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

    # Build per-reviewer JSON (accumulated, will be wrapped later)
    results_json="${results_json}\"$reviewer\":{\"engine\":\"$engine\",\"status\":\"$status\",\"fallback_used\":$fallback_used},"
  done

  # Remove trailing comma and close
  results_json="${results_json%,}}"

  # Output final JSON
  jq -nc \
    --arg phase "review" \
    --argjson results "$results_json" \
    --argjson success_count "$success_count" \
    --arg failed "$failed_list" \
    '{phase: $phase, results: $results, success_count: $success_count, failed: ($failed | split(",") | map(select(. != "")))}'
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

  # Dispatch to each engine in parallel
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
      "${model_args[@]}" &
    pids+=($!)
  done

  # Wait for all
  local exit_codes=()
  for pid in "${pids[@]}"; do
    wait "$pid" && exit_codes+=(0) || exit_codes+=($?)
  done

  # Collect results
  local results_json="{"
  local success_count=0
  local failed_list=""
  local validate_count=0
  local dispute_count=0
  local amend_count=0
  local new_finding_count=0

  for engine in "${engines_list[@]}"; do
    local output_file="$OUTPUT_DIR/xr${ROUND}-${engine}.md"
    local status="success"

    if [[ -f "$output_file" ]] && head -1 "$output_file" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
      status="failed"
      failed_list="${failed_list:+$failed_list,}$engine"
    else
      success_count=$((success_count + 1))
      # Count verdicts
      if [[ -f "$output_file" ]]; then
        validate_count=$((validate_count + $(grep -ci 'VALIDATE' "$output_file" 2>/dev/null || echo 0)))
        dispute_count=$((dispute_count + $(grep -ci 'DISPUTE' "$output_file" 2>/dev/null || echo 0)))
        amend_count=$((amend_count + $(grep -ci 'AMEND' "$output_file" 2>/dev/null || echo 0)))
        new_finding_count=$((new_finding_count + $(grep -c 'New Finding' "$output_file" 2>/dev/null || echo 0)))
      fi
    fi

    results_json="${results_json}\"$engine\":{\"status\":\"$status\"},"
  done

  results_json="${results_json%,}}"

  jq -nc \
    --arg phase "cross-exam" \
    --argjson round "$ROUND" \
    --argjson results "$results_json" \
    --argjson success_count "$success_count" \
    --arg failed "$failed_list" \
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
