const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-L5HHNHVNQD";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default function Analytics() {
  return (
    <>
      {/*
       * Consent defaults must run before gtag.js executes.
       * This inline script is synchronous (runs during HTML parsing, ~0ms).
       * The async gtag.js download below takes at minimum ~20ms over the network,
       * so consent is always set before the library runs — no race condition.
       */}
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
      {/* Literal src tag — required for Google Tag Assistant to detect the tag */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `gtag('js', new Date()); gtag('config', '${GA_ID}');`,
        }}
      />
    </>
  );
}
