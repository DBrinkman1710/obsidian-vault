const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-QN742BWE1G";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * All three script tags render in the server HTML so Google tag verification
 * finds the gtag.js src in the page source. next/script afterInteractive is
 * deliberately avoided — it injects via JS after hydration, making the tag
 * invisible to simple HTTP-based verifiers.
 *
 * Order: consent-init → gtag.js → ga-config (Consent Mode V2 requirement).
 */
export default function Analytics() {
  return (
    <>
      {/* 1. Set consent defaults before gtag.js evaluates anything */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            try {
              var _c = localStorage.getItem('yippie_consent');
              gtag('consent','default', _c === 'accepted'
                ? {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'}
                : {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500}
              );
            } catch(e) {
              gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
            }
          `,
        }}
      />

      {/* 2. Load the GA library — appears in page source HTML */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />

      {/* 3. Configure GA */}
      <script
        dangerouslySetInnerHTML={{
          __html: `gtag('js',new Date());gtag('config','${GA_ID}');`,
        }}
      />
    </>
  );
}
