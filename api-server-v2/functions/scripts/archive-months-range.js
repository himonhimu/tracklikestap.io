/**
 * Archive a range of months into separate DBs, then optionally delete those months from live.
 * Months outside the range are left untouched in the live DB.
 *
 * Default (today = Jul 2026): 2026-02 → previous month (2026-06)
 *
 * Usage:
 *   npm run archive-months-range
 *   npm run archive-months-range -- --delete
 *   npm run archive-months-range -- 2026-02 2026-06 --delete
 *   npm run archive-months-range -- --from 2026-02 --to 2026-06 --delete
 *
 * Without --delete: copy + verify each month only.
 * With --delete: after each month verifies, delete that month from live.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "..", "..", ".env") });

const {
  normalizeYearMonth,
  currentYearMonth,
  monthsBetween,
  copyMonthEventsToArchive,
  deleteMonthFromLive,
  listArchiveMonths,
  monthBounds,
} = await import("../archive-db.js");

function previousYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function yearMonthsInRange(fromYm, toYm) {
  const from = normalizeYearMonth(fromYm);
  const to = normalizeYearMonth(toYm);
  if (!from || !to) return [];
  if (from > to) return [];
  const fromBounds = monthBounds(from);
  const toBounds = monthBounds(to);
  return monthsBetween(fromBounds.start.slice(0, 10), toBounds.end.slice(0, 10));
}

function parseArgs(argv) {
  const args = argv.filter((a) => a !== "--");
  const doDelete = args.includes("--delete");
  const filtered = args.filter((a) => a !== "--delete");

  let from = null;
  let to = null;

  const fromIdx = filtered.indexOf("--from");
  const toIdx = filtered.indexOf("--to");
  if (fromIdx >= 0 && filtered[fromIdx + 1]) {
    from = filtered[fromIdx + 1];
  }
  if (toIdx >= 0 && filtered[toIdx + 1]) {
    to = filtered[toIdx + 1];
  }

  const positionals = filtered.filter(
    (a, i) =>
      a !== "--from" &&
      a !== "--to" &&
      filtered[i - 1] !== "--from" &&
      filtered[i - 1] !== "--to",
  );

  if (!from && positionals[0]) from = positionals[0];
  if (!to && positionals[1]) to = positionals[1];

  // Defaults: Feb of current year (or 2026-02) → last completed month
  if (!from) from = "2026-02";
  if (!to) to = previousYearMonth();

  return {
    doDelete,
    from: normalizeYearMonth(from),
    to: normalizeYearMonth(to),
  };
}

async function main() {
  const { doDelete, from, to } = parseArgs(process.argv.slice(2));

  if (!from || !to) {
    console.error("[archive-months-range] Invalid --from / --to (use YYYY-MM)");
    process.exit(1);
  }

  const current = currentYearMonth();
  let months = yearMonthsInRange(from, to);

  // Never archive the open current month
  months = months.filter((ym) => ym !== current);

  if (months.length === 0) {
    console.error(
      `[archive-months-range] No months to archive in ${from} .. ${to} (current=${current})`,
    );
    process.exit(1);
  }

  console.log(`[archive-months-range] Range: ${from} → ${to}`);
  console.log(`[archive-months-range] Months: ${months.join(", ")}`);
  console.log(
    `[archive-months-range] Mode: ${doDelete ? "COPY + DELETE from live" : "COPY only (add --delete to purge live)"}`,
  );
  console.log(
    "[archive-months-range] Months outside this range stay in live DB.",
  );
  console.log("");

  const existing = await listArchiveMonths();
  if (existing.length) {
    console.log(
      `[archive-months-range] Already archived: ${existing.map((a) => a.yearMonth).join(", ")}`,
    );
  }

  const results = [];

  for (const ym of months) {
    console.log("────────────────────────────────────────");
    console.log(`[archive-months-range] >>> ${ym}`);

    try {
      const copyResult = await copyMonthEventsToArchive(ym);
      console.log(`[archive-months-range] Copy:`, copyResult);

      if (
        copyResult.liveCount > 0 &&
        copyResult.archiveCount < copyResult.liveCount
      ) {
        console.error(
          `[archive-months-range] VERIFY FAIL ${ym}: archive=${copyResult.archiveCount} < live=${copyResult.liveCount}. Skipping delete; stopping.`,
        );
        results.push({ yearMonth: ym, ok: false, copyResult });
        break;
      }

      let deleteResult = null;
      if (doDelete && copyResult.liveCount > 0) {
        deleteResult = await deleteMonthFromLive(ym);
        console.log(`[archive-months-range] Delete:`, deleteResult);
      } else if (doDelete && copyResult.liveCount === 0) {
        console.log(
          `[archive-months-range] Nothing to delete for ${ym} (already gone from live or empty).`,
        );
      }

      results.push({ yearMonth: ym, ok: true, copyResult, deleteResult });
    } catch (err) {
      console.error(`[archive-months-range] Error on ${ym}:`, err.message || err);
      results.push({ yearMonth: ym, ok: false, error: String(err.message || err) });
      break;
    }
  }

  console.log("────────────────────────────────────────");
  console.log("[archive-months-range] Summary:");
  for (const r of results) {
    const status = r.ok ? "OK" : "FAIL";
    const live = r.copyResult?.liveCount ?? "?";
    const arch = r.copyResult?.archiveCount ?? "?";
    const deleted = r.deleteResult?.deleted ?? (doDelete ? 0 : "n/a");
    console.log(
      `  ${r.yearMonth}: ${status}  live=${live} archive=${arch} deleted=${deleted}${r.error ? " — " + r.error : ""}`,
    );
  }

  if (!doDelete) {
    console.log("");
    console.log(
      "[archive-months-range] Copy done. Re-run with --delete to remove these months from live:",
    );
    console.log(
      `  npm run archive-months-range -- ${from} ${to} --delete`,
    );
  } else {
    console.log("");
    console.log(
      "[archive-months-range] Done. event_counts kept in live. Other months kept in live.",
    );
  }

  const failed = results.some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("[archive-months-range] Error:", err);
  process.exit(1);
});
