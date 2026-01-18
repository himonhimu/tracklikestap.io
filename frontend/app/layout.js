import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";

export const metadata = {
  title: "Tracklikestap.io - Analytics",
  description: "Minimal Next.js Analytics",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default async function RootLayout({ children }) {
  // Use ONLY the pixel ID from API server (single source of truth)
  // DO NOT use NEXT_PUBLIC_FB_PIXEL_ID to avoid double pixels
  let FB_PIXEL_ID = null; 
   try {
    if (API_URL) {
      const response = await fetch(`${API_URL}/get-pixel`, {
        cache: 'no-store', // Always fetch fresh
      });
      // console.log("[layout] response:", response);
      if (response.ok) {
        const data = await response.json();
        FB_PIXEL_ID = data.pixel;
      }
    }
  } catch (err) {
    console.warn("[layout] Failed to fetch pixel ID from API:", err);
    // If API is not available, don't load any pixel (avoid double pixels)
  }
  console.log("[layout] FB_PIXEL_ID:", FB_PIXEL_ID);
  
  return (
    <html lang="en">
      <head>
        {/* Inject API URL for client-side scripts */}
        {API_URL && (
          <>
            <meta name="next-public-api-url" content={API_URL} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.NEXT_PUBLIC_API_URL = ${JSON.stringify(API_URL)};`,
              }}
            />
          </>
        )}
        {FB_PIXEL_ID ? (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src='https://connect.facebook.net/en_US/fbevents.js';
                  s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script');
                 fbq('init', '${FB_PIXEL_ID}');
                  window._fbPixelInitialized = '${FB_PIXEL_ID}';
                  console.log('[FB Pixel] ✅ Initialized with ID: ${FB_PIXEL_ID}');
                  // PageView tracking is handled server-side via Conversions API
                `,
              }}
            />
            <noscript>
              <img
                alt=""
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
              />
            </noscript>
          </>
        ) : null}
        <script src="/script.js" defer></script>

      </head>
      <body>
        {/* <GTMPageViewTracker/> */}
        {children}
        {/* <GoogleTagManager gtmId={'GTM-TZP6P4V4'} /> */}
        </body>
    </html>
  );
}
