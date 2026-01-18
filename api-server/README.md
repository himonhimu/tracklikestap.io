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
const response = await fetch('http://localhost:3001/api/event', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    path: '/products/item-123',
    event: 'PageView',
  }),
});

const result = await response.json();
console.log(result);

// Get analytics
const analytics = await fetch('http://localhost:3001/api/analytics/users/total');
const data = await analytics.json();
console.log(data);
```

## CORS

The server has CORS enabled by default, allowing requests from any origin. In production, you may want to restrict this:

```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## Deployment

The API server can be deployed independently from the Next.js app. You can:

1. Deploy to a separate server/container
2. Use a process manager like PM2
3. Deploy to services like Railway, Render, or Heroku

Make sure to set all environment variables in your deployment environment.
