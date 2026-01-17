import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";

export const metadata = {
  title: "Tracklikestap.io - Analytics",
  description: "Minimal Next.js Analytics",
};

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
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
        <GoogleTagManager gtmId={'GTM-TZP6P4V4'} />
        </body>
    </html>
  );
}
