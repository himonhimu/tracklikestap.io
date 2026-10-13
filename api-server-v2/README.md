# API Server

Standalone Express API server for analytics tracking. All server logic is contained within this folder, making it easy to use in other projects.

## Installation

Install dependencies:

```bash
npm install
```

Or install from the project root:

```bash
cd api-server
npm install
```

## Environment Variables

The server reads environment variables from `.env.local` in the project root. Make sure you have:

```env
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=tracklikestap

# Facebook Pixel
NEXT_PUBLIC_FB_PIXEL_ID=your_pixel_id
NEXT_PUBLIC_FB_ACCESS_TOKEN=your_access_token
NEXT_PUBLIC_FB_TEST_EVENT_CODE=your_test_code (optional)

# API Server
API_PORT=3001
NODE_ENV=development
```

## Running the Server

### Development (with auto-reload)

```bash
npm run dev
```

### Production

```bash
npm start
```

Or from project root:

```bash
npm run api:dev    # Development
npm run api:start  # Production
```

The server will start on `http://localhost:3001` (or the port specified in `API_PORT`).

## Database Setup

Initialize the database tables:

```bash
npm run init-db
```

Or from project root:

```bash
cd api-server
npm run init-db
```

This will create the `events` and `unique_users` tables in your MySQL database.

## Archiving events

Completed months of `events` can be copied into a separate MySQL database per month, then optionally removed from the live database. `event_counts` stay in the live database so overview totals remain correct. The current open month is never archived or deleted.

Each archive database is named `{MYSQL_DATABASE}_YYYY_MM` (for example `tracklikestap_2026_01`). The MySQL user needs permission to create databases on the same server. Both scripts read `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` from `.env` in this folder.

Copy uses `INSERT IGNORE` by event id, then compares row counts. Delete runs only when the archive count is at least the live count for that month, in batches of 5,000 rows. Months outside the requested range stay in the live database.

### One month

Archive the previous calendar month and delete it from live:

```bash
npm run archive-last-month
```

That runs `archive-month previous --delete`: it copies last month into its archive database, then deletes those rows from live after the counts match. The current month is left in place.

Other one-month commands:

```bash
npm run archive-month -- 2026-01
npm run archive-month -- 2026-01 --delete
npm run archive-month -- previous
npm run archive-month -- previous --delete
```

| Argument             | Meaning                                                         |
| -------------------- | --------------------------------------------------------------- |
| `YYYY-MM`            | Calendar month to archive (`2026_01` is accepted too)           |
| `previous` or `prev` | Last completed month                                            |
| `--delete`           | After a successful copy and verify, delete that month from live |

Without `--delete` the script copies and verifies only. With no month argument it lists existing archive databases and exits.

### Monthly cron (aaPanel)

`functions/scripts/cron-archive-last-month.sh` archives the previous calendar month and deletes it from live. It loads MySQL settings from `.env`, writes `logs/archive-last-month.log`, and skips the run if another copy is already going.

In aaPanel, add a cron task:

| Field  | Value                                                                      |
| ------ | -------------------------------------------------------------------------- |
| Type   | Shell script                                                               |
| Cycle  | Monthly, day **1**, **02:10** (server timezone, after midnight)            |
| Script | `bash /path/to/api-server-v2/functions/scripts/cron-archive-last-month.sh` |

If the cron environment cannot find Node, set `NODE_BIN` to the binary aaPanel installed:

```bash
NODE_BIN=/www/server/nodejs/v20.18.0/bin/node bash /path/to/api-server-v2/functions/scripts/cron-archive-last-month.sh
```

The same job from this folder, without the log wrapper:

```bash
npm run archive-last-month
```

### A range of months

```bash
npm run archive-months-range
npm run archive-months-range -- --delete
npm run archive-months-range -- 2026-02 2026-06 --delete
npm run archive-months-range -- --from 2026-02 --to 2026-06 --delete
```

| Option            | Meaning                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| _(none)_          | Copy `2026-02` through the previous completed month. Does not delete from live. |
| `--from YYYY-MM`  | First month in the range (inclusive). Default `2026-02`.                        |
| `--to YYYY-MM`    | Last month in the range (inclusive). Default is the previous completed month.   |
| `YYYY-MM YYYY-MM` | Same as `--from` and `--to`, in that order.                                     |
| `--delete`        | After each month copies and verifies, delete that month from live.              |

The range is walked one month at a time. The current month is skipped even if it falls inside `--from` / `--to`. If a month fails verification (`archive` count lower than `live`) or throws, the script stops there, skips delete for that month, and exits with status 1. Months already copied are left as they are; re-running is safe because copy ignores existing ids.

List archive databases the API can query:

```
GET /api/analytics/archives
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Event Tracking

```
POST /api/event
```

Track analytics events.

**Request Body:**

```json
{
  "path": "/products/item-123",
  "event": "PageView",
  "product": {
    "id": "123",
    "name": "Product Name",
    "price": 29.99,
    "currency": "USD"
  },
  "products": [
    {
      "id": "123",
      "price": 29.99,
      "quantity": 2
    }
  ],
  "value": 59.98,
  "currency": "USD",
  "referrer": "https://google.com",
  "ts": 1234567890,
  "event_id": "unique-event-id",
  "ua": "Mozilla/5.0..."
}
```

**Response:**

```json
{
  "ok": true
}
```

### Analytics Queries

#### Get Total Unique Users

```
GET /api/analytics/users/total
```

#### Get Users by Device

```
GET /api/analytics/users/by-device
```

#### Get Users by Location

```
GET /api/analytics/users/by-location
```

#### Get Event Counts

```
GET /api/analytics/events/counts
```

#### Get Purchase Events

```
GET /api/analytics/events/purchases?limit=50
```

#### Get Add to Cart Events

```
GET /api/analytics/events/add-to-cart?limit=50
```

#### Get Recent Users

```
GET /api/analytics/users/recent?limit=50
```

## Example Usage

### Using cURL

```bash
# Track a page view
curl -X POST http://localhost:3001/api/event \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/products/item-123",
    "event": "PageView"
  }'

# Track add to cart
curl -X POST http://localhost:3001/api/event \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/products/item-123",
    "event": "AddToCart",
    "product": {
      "id": "123",
      "name": "Product Name",
      "price": 29.99,
      "currency": "USD"
    }
  }'

# Get analytics
curl http://localhost:3001/api/analytics/users/total
```

### Using JavaScript/Fetch

```javascript
// Track event
const response = await fetch("http://localhost:3001/api/event", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    path: "/products/item-123",
    event: "PageView",
  }),
});

const result = await response.json();
console.log(result);

// Get analytics
const analytics = await fetch(
  "http://localhost:3001/api/analytics/users/total",
);
const data = await analytics.json();
console.log(data);
```

## CORS

The server has CORS enabled by default, allowing requests from any origin. In production, you may want to restrict this:

```javascript
app.use(
  cors({
    origin: "https://yourdomain.com",
    credentials: true,
  }),
);
```

## Deployment

The API server can be deployed independently from the Next.js app. You can:

1. Deploy to a separate server/container
2. Use a process manager like PM2
3. Deploy to services like Railway, Render, or Heroku

Make sure to set all environment variables in your deployment environment.
