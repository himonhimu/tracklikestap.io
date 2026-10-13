#!/usr/bin/env bash
# aaPanel cron: archive the previous calendar month, then delete it from live.
#
# Schedule on day 1, after midnight in the server timezone (for example 02:10).
# "previous" is the month that just ended. The open month is never touched.
# Re-runs are safe: copy ignores rows already archived, and delete is skipped
# when that month is already gone from live.
#
# aaPanel → Cron → Add task
#   Type:    Shell script
#   Name:    Archive last month
#   Cycle:   Monthly, day 1, 02:10
#   Script:  bash /path/to/api-server-v2/functions/scripts/cron-archive-last-month.sh
#
# If cron cannot find node, set NODE_BIN to the binary aaPanel installed, for example:
#   NODE_BIN=/www/server/nodejs/v20.18.0/bin/node

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${ROOT}/logs"
LOG_FILE="${LOG_DIR}/archive-last-month.log"
LOCK_FILE="${LOG_DIR}/archive-last-month.lock"
SCRIPT="${ROOT}/functions/scripts/archive-month.js"

mkdir -p "${LOG_DIR}"
exec >>"${LOG_FILE}" 2>&1

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

find_node() {
  if [[ -n "${NODE_BIN:-}" ]]; then
    if [[ -x "${NODE_BIN}" ]]; then
      printf '%s\n' "${NODE_BIN}"
      return 0
    fi
    log "[cron-archive] NODE_BIN is set but not executable: ${NODE_BIN}"
    return 1
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local candidate
  for candidate in /usr/local/bin/node /usr/bin/node; do
    if [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  shopt -s nullglob
  local matches=(/www/server/nodejs/*/bin/node)
  shopt -u nullglob
  if ((${#matches[@]} > 0)); then
    printf '%s\n' "${matches[@]}" | sort -V | tail -n 1
    return 0
  fi

  return 1
}

if ! NODE="$(find_node)"; then
  log "[cron-archive] node not found. Set NODE_BIN to the node binary."
  exit 1
fi

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "[cron-archive] another run is in progress, exiting"
  exit 0
fi

log "[cron-archive] start node=${NODE} root=${ROOT}"
set +e
"${NODE}" "${SCRIPT}" previous --delete
status=$?
set -e

if [[ "${status}" -eq 0 ]]; then
  log "[cron-archive] done"
else
  log "[cron-archive] failed exit=${status}"
fi

exit "${status}"
