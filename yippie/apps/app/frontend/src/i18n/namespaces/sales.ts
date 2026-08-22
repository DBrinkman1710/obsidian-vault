// sales namespace — owned by the sales translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const sales: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // SalesPage — header
    sales_title:                        'Sales Tracking',
    sales_subtitle:                     'Track visitor behaviour on your clients\' websites and surface it inside Yippie contact cards.',
    sales_last_event:                   'Last event:',
    sales_settings_title:               'Settings',

    // SalesPage — stats strip labels
    sales_stat_pageviews:               'Page views',
    sales_stat_purchases:               'Purchases',
    sales_stat_conversion:              'Conversion rate',

    // SalesPage — top pages table
    sales_top_pages_heading:            'Top pages (all time)',
    sales_col_page:                     'Page',
    sales_col_views:                    'Views',

    // SalesPage — error state
    sales_error_title:                  'Could not load sales data',
    sales_error_subtitle:               'Check that the Sales Tracking module is enabled for your account.',

    // SalesPage — empty state
    sales_empty_title:                  'No events yet',
    sales_empty_subtitle:               'Click the settings icon above to get your installation snippet.',

    // SalesPage — relative time
    sales_relative_never:               'Never',
    sales_relative_just_now:            'Just now',

    // SalesSettingsModal — header & footer
    sales_modal_title:                  'Sales Tracking: Settings',
    sales_modal_close:                  'Close',

    // SalesSettingsModal — tab labels
    sales_tab_how_it_works:             'How it works',
    sales_tab_install_snippet:          'Install snippet',

    // CopyButton (shared within modal)
    sales_copied:                       'Copied',
    sales_copy:                         'Copy',

    // OverviewTab
    sales_overview_intro:               'The Sales tracking snippet collects visitor behaviour on your clients\' websites and surfaces it inside Yippie, so when a customer contacts support, agents already know what they browsed, clicked, or purchased.',
    sales_overview_step1_title:         '1. Copy your snippet',
    sales_overview_step1_desc:          'Go to the Install snippet tab, copy the one-line {script} tag, and paste it inside the {head} of your client\'s website. Each tenant has a unique token. No code changes needed after installation.',
    sales_overview_step2_title:         '2. It tracks automatically',
    sales_overview_step2_desc:          'Once the tag is live, every page view is recorded automatically. No extra code needed. To track purchases or button clicks, call {call} anywhere on the page.',
    sales_overview_step3_title:         '3. Link visitors to contacts',
    sales_overview_step3_desc:          'When a visitor logs in or places an order, call {call}. Yippie matches the anonymous session to an existing Yippie contact. From that moment, the "Website activity" card appears on their ticket detail page.',
    sales_overview_step4_title:         '4. Agents see it on every ticket',
    sales_overview_step4_desc:          'The last 5 website events appear in the Website activity card on the right side of every ticket from that contact. Agents know what the customer browsed before they even read the first line.',

    // SnippetTab
    sales_snippet_intro:                'Copy the script tag and paste it inside the {head} of your client\'s website. Page views are tracked automatically the moment it loads.',
    sales_snippet_script_label:         'Script tag',
    sales_snippet_loading:              'Loading…',
    sales_snippet_example_label:        'Full example with event tracking',
    sales_token_label:                  'Tracking token',
    sales_token_hint:                   'Your token authenticates events from your client\'s website. Rotate it if it is ever leaked — you\'ll need to update the snippet on the website immediately after.',
    sales_rotate_btn:                   'Rotate token',
    sales_rotate_toast:                 'Tracking token rotated. Update your snippet.',
    sales_rotate_error_toast:           'Failed to rotate token',
  },
  nl: {
    // SalesPage — header
    sales_title:                        'Verkoopanalytics',
    sales_subtitle:                     'Volg bezoekersgedrag op de websites van je klanten en toon dit in Yippie-contactkaarten.',
    sales_last_event:                   'Laatste event:',
    sales_settings_title:               'Instellingen',

    // SalesPage — stats strip labels
    sales_stat_pageviews:               'Paginaweergaven',
    sales_stat_purchases:               'Aankopen',
    sales_stat_conversion:              'Conversieratio',

    // SalesPage — top pages table
    sales_top_pages_heading:            'Populairste pagina\'s (alle tijd)',
    sales_col_page:                     'Pagina',
    sales_col_views:                    'Weergaven',

    // SalesPage — error state
    sales_error_title:                  'Kan verkoopdata niet laden',
    sales_error_subtitle:               'Controleer of de module Verkoopanalytics is ingeschakeld voor je account.',

    // SalesPage — empty state
    sales_empty_title:                  'Nog geen events',
    sales_empty_subtitle:               'Klik op het instellingenpictogram hierboven om je installatiesnippet te krijgen.',

    // SalesPage — relative time
    sales_relative_never:               'Nooit',
    sales_relative_just_now:            'Zojuist',

    // SalesSettingsModal — header & footer
    sales_modal_title:                  'Verkoopanalytics: Instellingen',
    sales_modal_close:                  'Sluiten',

    // SalesSettingsModal — tab labels
    sales_tab_how_it_works:             'Hoe het werkt',
    sales_tab_install_snippet:          'Snippet installeren',

    // CopyButton (shared within modal)
    sales_copied:                       'Gekopieerd',
    sales_copy:                         'Kopieer',

    // OverviewTab
    sales_overview_intro:               'De verkooptracking-snippet verzamelt bezoekersgedrag op de websites van je klanten en toont dit in Yippie, zodat medewerkers al weten wat een klant heeft bekeken, aangeklikt of gekocht wanneer die contact opneemt.',
    sales_overview_step1_title:         '1. Kopieer je snippet',
    sales_overview_step1_desc:          'Ga naar het tabblad Snippet installeren, kopieer de {script}-tag op één regel en plak die in de {head} van de website van je klant. Elke tenant heeft een uniek token. Na installatie zijn geen codewijzigingen meer nodig.',
    sales_overview_step2_title:         '2. Automatisch bijhouden',
    sales_overview_step2_desc:          'Zodra de tag live staat, wordt elke paginaweergave automatisch geregistreerd. Geen extra code nodig. Om aankopen of klikken bij te houden, roep je {call} aan op de pagina.',
    sales_overview_step3_title:         '3. Bezoekers koppelen aan contacten',
    sales_overview_step3_desc:          'Wanneer een bezoeker inlogt of een bestelling plaatst, roep je {call} aan. Yippie koppelt de anonieme sessie aan een bestaand Yippie-contact. Vanaf dat moment verschijnt de kaart "Websiteactiviteit" op de ticketdetailpagina.',
    sales_overview_step4_title:         '4. Medewerkers zien het bij elk ticket',
    sales_overview_step4_desc:          'De laatste 5 website-events verschijnen in de kaart Websiteactiviteit aan de rechterkant van elk ticket van dat contact. Medewerkers weten al wat de klant heeft bekeken voordat ze de eerste regel lezen.',

    // SnippetTab
    sales_snippet_intro:                'Kopieer de script-tag en plak die in de {head} van de website van je klant. Paginaweergaven worden automatisch bijgehouden zodra de tag is geladen.',
    sales_snippet_script_label:         'Script-tag',
    sales_snippet_loading:              'Laden…',
    sales_snippet_example_label:        'Volledig voorbeeld met eventtracking',
    sales_token_label:                  'Trackingtoken',
    sales_token_hint:                   'Je token authenticeert events van de website van je klant. Roteer het als het ooit uitlekt — je moet de snippet op de website dan direct bijwerken.',
    sales_rotate_btn:                   'Token roteren',
    sales_rotate_toast:                 'Trackingtoken geroteerd. Werk je snippet bij.',
    sales_rotate_error_toast:           'Roteren van token mislukt',
  },
}
