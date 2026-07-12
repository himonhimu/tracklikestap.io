/**
 * Classify traffic source from referrer URL and/or utm_source.
 */

const SOURCE_RULES = [
  { source: "Google", match: /(^|\.)google\.|googlesyndication\.|googleadservices\.|googleapis\.|g\.co$/i },
  { source: "Facebook", match: /(^|\.)facebook\.|(^|\.)fb\.com$|(^|\.)fb\.me$|(^|\.)instagram\.|(^|\.)meta\.com$/i },
  { source: "YouTube", match: /(^|\.)youtube\.|(^|\.)youtu\.be$|(^|\.)ytimg\./i },
  { source: "TikTok", match: /(^|\.)tiktok\./i },
  { source: "Twitter/X", match: /(^|\.)twitter\.|(^|\.)x\.com$|(^|\.)t\.co$/i },
  { source: "LinkedIn", match: /(^|\.)linkedin\.|(^|\.)lnkd\.in$/i },
  { source: "WhatsApp", match: /(^|\.)whatsapp\.|(^|\.)wa\.me$/i },
  { source: "Bing", match: /(^|\.)bing\./i },
  { source: "Yahoo", match: /(^|\.)yahoo\./i },
  { source: "Reddit", match: /(^|\.)reddit\./i },
  { source: "Pinterest", match: /(^|\.)pinterest\./i },
  { source: "Telegram", match: /(^|\.)t\.me$|(^|\.)telegram\./i },
];

const UTM_MAP = {
  google: "Google",
  googleads: "Google",
  adwords: "Google",
  cpc: "Google",
  facebook: "Facebook",
  fb: "Facebook",
  ig: "Facebook",
  instagram: "Facebook",
  meta: "Facebook",
  youtube: "YouTube",
  yt: "YouTube",
  tiktok: "TikTok",
  twitter: "Twitter/X",
  x: "Twitter/X",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  bing: "Bing",
  yahoo: "Yahoo",
  reddit: "Reddit",
  pinterest: "Pinterest",
  telegram: "Telegram",
};

function hostnameFromUrl(raw) {
  if (!raw || !String(raw).trim()) return null;
  let s = String(raw).trim();
  try {
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    return new URL(s).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function mapUtmSource(utm) {
  if (!utm) return null;
  const key = String(utm).trim().toLowerCase();
  if (UTM_MAP[key]) return UTM_MAP[key];
  // Title-case unknown utm
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * @param {string|null} referrer
 * @param {string|null} fullUrl - landing page (for utm_source + direct detection)
 * @returns {string} e.g. Google, Facebook, Direct, Other
 */
export function classifyReferralSource(referrer = null, fullUrl = null) {
  // Prefer utm_source when present
  try {
    if (fullUrl) {
      const u = new URL(
        /^https?:\/\//i.test(fullUrl) ? fullUrl : `https://${fullUrl}`,
      );
      const utm = u.searchParams.get("utm_source");
      if (utm && String(utm).trim()) {
        return mapUtmSource(utm);
      }
    }
  } catch {
    // ignore
  }

  const refHost = hostnameFromUrl(referrer);
  if (!refHost) return "Direct";

  // Same-site referrer = Direct
  try {
    if (fullUrl) {
      const pageHost = hostnameFromUrl(fullUrl);
      if (pageHost && (refHost === pageHost || refHost.endsWith("." + pageHost) || pageHost.endsWith("." + refHost))) {
        return "Direct";
      }
    }
  } catch {
    // ignore
  }

  for (const rule of SOURCE_RULES) {
    if (rule.match.test(refHost)) return rule.source;
  }

  return "Other";
}

/**
 * Hostname label for "Other" drill-down (optional).
 */
export function referrerHostLabel(referrer) {
  return hostnameFromUrl(referrer) || "unknown";
}
