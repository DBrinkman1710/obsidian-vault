export default function ConsentDefaults() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          try {
            var _c = localStorage.getItem('yippie_consent');
            window.__yippie_consent = (_c === 'accepted');
            gtag('consent','default', _c === 'accepted'
              ? {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'}
              : {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500}
            );
          } catch(e) {
            window.__yippie_consent = false;
            gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
          }
        `,
      }}
    />
  );
}
