import Script from "next/script";

/**
 * Google Analytics 4 + Consent Mode v2.
 *
 * Storage defaults to `denied` (AVG/GDPR-safe) until the visitor makes a choice
 * in the cookie banner. The inline init script runs before gtag.js loads, so the
 * default consent state is set first; if the visitor previously accepted, we load
 * straight away with `granted`. The banner (CookieBanner.tsx) flips the state via
 * `gtag('consent', 'update', …)`.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-QN742BWE1G";

// gtag/dataLayer live on window once the init script runs — declare them once
// here so CookieBanner (and anywhere else) can call window.gtag with types.
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default function Analytics() {
  return (
    <>
      {/* Consent Mode defaults — must run before gtag.js. */}
      <script
        id="consent-init"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            if (localStorage.getItem('yippie_consent') === 'accepted') {
              gtag('consent', 'default', {
                'ad_storage': 'granted',
                'ad_user_data': 'granted',
                'ad_personalization': 'granted',
                'analytics_storage': 'granted'
              });
            } else {
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'analytics_storage': 'denied',
                'wait_for_update': 500
              });
            }
          `,
        }}
      />

      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `,
        }}
      />
    </>
  );
}
