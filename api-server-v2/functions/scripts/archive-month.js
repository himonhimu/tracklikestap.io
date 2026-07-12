/**
 * Archive one calendar month into its own database, then delete from live.
 *
 * Usage:
 *   npm run archive-month -- 2026-01
 *   npm run archive-month -- 2026-01 --delete
 *   npm run archive-month -- previous          # last completed month
 *   npm run archive-month -- previous --delete
 *
 * Without --delete: copy + verify only (safe dry run for delete step).
 * With --delete: delete from live only after archive count >= live count.
 *
 * event_counts in live are kept (Overview totals stay correct).
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
  copyMonthEventsToArchive,
  deleteMonthFromLive,
  listArchiveMonths,
} = await import("../archive-db.js");

function previousYearMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const doDelete = args.includes("--delete");
  const monthArg = args.find((a) => a !== "--delete");

  if (!monthArg) {
    console.log(`Usage:
  node functions/scripts/archive-month.js 2026-01 [--delete]
  node functions/scripts/archive-month.js previous [--delete]

Existing archives:`);
    const existing = await listArchiveMonths();
    for (const a of existing) {
      console.log(`  ${a.yearMonth} → ${a.database}`);
    }
    if (existing.length === 0) console.log("  (none)");
    process.exit(1);
  }

  const yearMonth =
    monthArg === "previous" || monthArg === "prev"
      ? previousYearMonth()
      : normalizeYearMonth(monthArg);

  if (!yearMonth) {
    console.error(`[archive-month] Invalid month: ${monthArg}`);
    process.exit(1);
  }

  if (yearMonth === currentYearMonth()) {
    console.error(
      `[archive-month] Cannot archive current month (${yearMonth}). Wait until next month.`,
    );
    process.exit(1);
  }

  console.log(`[archive-month] Archiving ${yearMonth}...`);
  const copyResult = await copyMonthEventsToArchive(yearMonth);
  console.log("[archive-month] Copy result:", copyResult);

  if (copyResult.liveCount > 0 && copyResult.archiveCount < copyResult.liveCount) {
    console.error(
      `[archive-month] Verify failed: archive=${copyResult.archiveCount} < live=${copyResult.liveCount}. Not deleting.`,
    );
    process.exit(1);
  }

  if (!doDelete) {
    console.log(
      "[archive-month] Copy OK. Re-run with --delete to remove this month from live DB.",
    );
    process.exit(0);
  }

  console.log(`[archive-month] Deleting ${yearMonth} from live...`);
  const del = await deleteMonthFromLive(yearMonth);
  console.log("[archive-month] Delete result:", del);
  console.log(
    "[archive-month] Done. event_counts kept in live for Overview totals.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[archive-month] Error:", err);
  process.exit(1);
});
