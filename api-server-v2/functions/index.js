/**
 * API Server - Main exports
 * This module exports all the main functions for use in other projects
 */

export { getDb } from "./db.js";
export { processEvent } from "./handler.js";
export { sendFbEvent } from "./fb-pixel.js";
export {
  generateEventId,
  getClientIp,
  detectDeviceType,
  getIpGeolocation,
} from "./utils.js";
export {
  getTotalUniqueUsers,
  getUniqueUsersByDevice,
  getUniqueUsersByLocation,
  getEventCounts,
  getPurchaseEvents,
  getAddToCartEvents,
  getRecentUniqueUsers,
} from "./analytics-queries.js";
