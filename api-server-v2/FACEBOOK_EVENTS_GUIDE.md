# Facebook Events Troubleshooting Guide

## Understanding the Response

When you see:
```json
{
  "events_received": 1,
  "messages": [],
  "fbtrace_id": "ABC123..."
}
```

This means **Facebook successfully received your event!** ✅

## Why Events Might Not Appear in Events Manager

### 1. **Using Test Event Code** ⚠️ MOST COMMON ISSUE

If you have `FB_TEST_EVENT_CODE` set in your environment:

**Events will ONLY appear in:**
- Facebook Events Manager → **Test Events** tab (not the regular Events tab)
- Real-time view only (they don't appear in regular reports)

**To check:**
1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager2)
2. Select your Pixel
3. Click **"Test Events"** tab (not "Events")
4. You should see events in real-time there

**To see events in regular Events Manager:**
- Remove `FB_TEST_EVENT_CODE` from your `.env` file
- Restart your API server
- Send new events (they'll appear in regular Events tab after 5-10 minutes)

### 2. **Processing Delay**

Events can take **5-10 minutes** to appear in Events Manager (non-test events).

### 3. **Cookie Status**

- ✅ **`_fbp` (Facebook Browser ID)**: **REQUIRED** for good matching
  - Set by Facebook Pixel when it loads
  - Your logs show `has_fbp: true` ✅ - This is good!

- ⚠️ **`_fbc` (Facebook Click ID)**: **OPTIONAL** - Only for ad clicks
  - Only set when user clicks a Facebook ad (with `fbclid` parameter)
  - **NOT required** for events to work
  - Your logs show `has_fbc: false` - This is **NORMAL** if user didn't click an ad

### 4. **Event Deduplication**

If you're sending the same event both:
- Client-side (via `fbq('track')`)
- Server-side (via Conversions API)

Facebook will deduplicate them using the `event_id`. This is **good** - it prevents double counting.

### 5. **Check Event Matching Quality**

In Facebook Events Manager:
1. Go to **Events** tab
2. Click on an event
3. Check **"Diagnostics"** tab
4. Look for matching quality issues

## Current Status from Your Logs

Based on your logs:
- ✅ `events_received: 1` - Facebook received the event
- ✅ `has_fbp: true` - Good user matching data
- ✅ `event_source_url: 'http://localhost:3000/product'` - Correct frontend URL
- ⚠️ `has_fbc: false` - Normal (only present for ad clicks)

**Your setup looks correct!** The issue is likely:
1. You're using a test event code → Check **Test Events** tab
2. Or waiting for events to process → Wait 5-10 minutes

## How to Verify Events Are Working

### Option 1: Check Test Events (if using test code)
1. Go to Events Manager → Test Events tab
2. You should see events in real-time

### Option 2: Check Regular Events (if NOT using test code)
1. Go to Events Manager → Events tab
2. Wait 5-10 minutes
3. Filter by event type (PageView, AddToCart, Purchase)
4. Check the Diagnostics tab for matching quality

### Option 3: Use Facebook's Event Testing Tool
1. Go to Events Manager → Test Events
2. Click "Test Events" button
3. Enter your test event code
4. You'll see events appear in real-time

## Improving Event Matching

To improve matching quality (optional):

1. **Add hashed email/phone** (if available):
```javascript
// In your event payload
{
  email: "user@example.com",  // Will be hashed automatically
  phone: "+1234567890"         // Will be hashed automatically
}
```

2. **Ensure `_fbp` cookie is present** ✅ (You already have this)

3. **Use same `event_id` for client and server** ✅ (You're already doing this)

## Summary

- `_fbc: false` is **NOT a problem** - it's normal
- `_fbp: true` is **GOOD** - you have the important cookie
- `events_received: 1` means Facebook **received** your event
- Check **Test Events** tab if using test event code
- Wait 5-10 minutes for events to appear in regular Events tab

Your setup is working correctly! 🎉
