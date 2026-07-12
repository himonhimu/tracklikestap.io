# 1) Copy + verify only (safe)

npm run archive-month -- 2026-01

# 2) After verify OK — delete that month from live

npm run archive-month -- 2026-01 --delete

# Or last completed month

npm run archive-month -- previous --delete

If you ever need to rebuild counters from events:

npm run backfill-event-counts

# 1) Copy + verify only (safe)

npm run archive-months-range

# 2) After that looks good — delete those months from live

npm run archive-months-range -- --delete
Same thing, explicit months:

npm run archive-months-range -- 2026-02 2026-06 --delete

If you need to rebuild counts later:

npm run backfill-referral-counts
