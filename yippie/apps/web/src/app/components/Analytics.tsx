const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-L5HHNHVNQD";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Google tag (gtag.js) for the marketing site, with Consent Mode V2.
 *
 * This is emitted as a SINGLE inline <script> rendered into the server HTML via
 * dangerouslySetInnerHTML. That matters for two reasons:
 *
 * 1. Ordering. In the App Router, React 18 treats a JSX `<script async src>` as
 *    a hoisted resource and moves it to the TOP of <head> — ahead of any inline
 *    <script> blocks, regardless of JSX order. That caused gtag.js to load
 *    before our consent defaults ran, breaking Consent Mode V2. Injecting the
 *    loader ourselves from inside this inline script guarantees the required
 *    order: consent defaults → gtag.js → config.
 * 2. Visibility. The full gtag.js URL is present verbatim in the page source
 *    HTML (inside this script), and the loader runs on first paint, so Google's
 *    tag verification (which executes the page) detects the tag firing.
 */
export default function Analytics() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          // 1. Consent defaults — MUST run before gtag.js loads.
          try {
            var _c = localStorage.getItem('yippie_consent');
            gtag('consent','default', _c === 'accepted'
              ? {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'}
              : {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500}
            );
          } catch(e) {
            gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
          }

          // 2. Load the GA library: https://www.googletagmanager.com/gtag/js?id=${GA_ID}
          (function(){
            var s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
            document.head.appendChild(s);
          })();

          // 3. Configure GA.
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `,
      }}
    />
  );
}
