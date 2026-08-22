// saas namespace — owned by the saas translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const saas: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // SaasPage — header
    saas_title:                         'Product Analytics',
    saas_subtitle:                      'Track feature adoption, onboarding completion, and health scores for SaaS clients.',
    saas_settings_title:                'Settings',

    // SaasPage — stats strip labels
    saas_stat_contacts_tracked:         'Contacts tracked',
    saas_stat_onboarding:               'Onboarding completion',
    saas_stat_at_risk:                  'At-risk customers',

    // SaasPage — feature adoption card
    saas_top_features_heading:          'Top features this month',

    // SaasPage — errors card
    saas_common_errors_heading:         'Most common errors (30 days)',
    saas_col_error_code:                'Error code',
    saas_col_count:                     'Count',

    // SaasPage — error state
    saas_error_title:                   'Could not load product analytics',
    saas_error_subtitle:                'Check that the Product Analytics module is enabled for your account.',

    // SaasPage — empty state
    saas_empty_title:                   'No product data yet',
    saas_empty_subtitle:                'Click the settings icon above to get your installation snippet.',

    // SaasSettingsModal — header & footer
    saas_modal_title:                   'Product Analytics: Settings',
    saas_modal_close:                   'Close',

    // SaasSettingsModal — tab labels
    saas_tab_how_it_works:              'How it works',
    saas_tab_install_snippet:           'Install snippet',

    // CopyButton (shared within modal)
    saas_copied:                        'Copied',
    saas_copy:                          'Copy',

    // OverviewTab
    saas_overview_intro:                'The Product Analytics snippet tracks how customers use your SaaS product: feature adoption, onboarding completion, and errors. Every ticket from a tracked customer arrives with a silent briefing: what they\'ve done, what they\'ve skipped, where they got stuck.',
    saas_overview_step1_title:          '1. Add the snippet',
    saas_overview_step1_desc:           'Copy the one-line {script} tag from the Install snippet tab and paste it into your SaaS product\'s HTML, just before the closing {body} or inside {head}.',
    saas_overview_step2_title:          '2. Identify users after login',
    saas_overview_step2_desc:           'Call {call} right after a user logs in. Yippie links the browser session to a Yippie contact by email, so all events are attributed to the right person.',
    saas_overview_step3_title:          '3. Track what matters',
    saas_overview_step3_desc:           'Call {call} for the moments that matter: feature usage, onboarding steps completed or skipped, errors encountered, and upgrade intent (when a user visits your pricing page). The full event taxonomy is shown in the Install snippet tab.',
    saas_overview_step4_title:          '4. Health scores + agent context',
    saas_overview_step4_desc:           'Yippie computes a health score (0–100) for each tracked customer every hour, based on how recently they were active, how many features they use, and how many errors they hit. The score and last 4 events appear in the Product usage card on every ticket, so agents walk into every conversation already informed.',

    // SnippetTab
    saas_snippet_intro:                 'Copy the script tag and paste it into your SaaS product. Then call {identify} after login and {track} at key moments.',
    saas_snippet_script_label:          'Script tag',
    saas_snippet_loading:               'Loading…',
    saas_snippet_example_label:         'Full example',
    saas_snippet_events_label:          'Supported event types',
    saas_token_label:                   'Your token:',
  },
  nl: {
    // SaasPage — header
    saas_title:                         'Productanalytics',
    saas_subtitle:                      'Volg feature-adoptie, onboarding-voortgang en gezondheidsscores voor SaaS-klanten.',
    saas_settings_title:                'Instellingen',

    // SaasPage — stats strip labels
    saas_stat_contacts_tracked:         'Bijgehouden contacten',
    saas_stat_onboarding:               'Onboarding-voltooiing',
    saas_stat_at_risk:                  'Klanten met risico',

    // SaasPage — feature adoption card
    saas_top_features_heading:          'Populairste functies deze maand',

    // SaasPage — errors card
    saas_common_errors_heading:         'Meest voorkomende fouten (30 dagen)',
    saas_col_error_code:                'Foutcode',
    saas_col_count:                     'Aantal',

    // SaasPage — error state
    saas_error_title:                   'Kan productanalytics niet laden',
    saas_error_subtitle:                'Controleer of de module Productanalytics is ingeschakeld voor je account.',

    // SaasPage — empty state
    saas_empty_title:                   'Nog geen productdata',
    saas_empty_subtitle:                'Klik op het instellingenpictogram hierboven om je installatiesnippet te krijgen.',

    // SaasSettingsModal — header & footer
    saas_modal_title:                   'Productanalytics: Instellingen',
    saas_modal_close:                   'Sluiten',

    // SaasSettingsModal — tab labels
    saas_tab_how_it_works:              'Hoe het werkt',
    saas_tab_install_snippet:           'Snippet installeren',

    // CopyButton (shared within modal)
    saas_copied:                        'Gekopieerd',
    saas_copy:                          'Kopieer',

    // OverviewTab
    saas_overview_intro:                'De productanalytics-snippet registreert hoe klanten jouw SaaS-product gebruiken: feature-adoptie, onboarding-voortgang en fouten. Elk ticket van een bijgehouden klant arriveert met een stille briefing: wat ze hebben gedaan, wat ze hebben overgeslagen, waar ze vastliepen.',
    saas_overview_step1_title:          '1. Voeg de snippet toe',
    saas_overview_step1_desc:           'Kopieer de {script}-tag op één regel vanuit het tabblad Snippet installeren en plak die in de HTML van jouw SaaS-product, net voor het sluitende {body} of in {head}.',
    saas_overview_step2_title:          '2. Identificeer gebruikers na het inloggen',
    saas_overview_step2_desc:           'Roep {call} aan direct nadat een gebruiker is ingelogd. Yippie koppelt de browsersessie via e-mail aan een Yippie-contact, zodat alle events aan de juiste persoon worden toegeschreven.',
    saas_overview_step3_title:          '3. Houd bij wat telt',
    saas_overview_step3_desc:           'Roep {call} aan voor de momenten die ertoe doen: feature-gebruik, voltooide of overgeslagen onboarding-stappen, fouten en upgrade-intentie (wanneer een gebruiker je prijspagina bezoekt). De volledige event-taxonomie staat in het tabblad Snippet installeren.',
    saas_overview_step4_title:          '4. Gezondheidsscores en agentcontext',
    saas_overview_step4_desc:           'Yippie berekent elk uur een gezondheidsscore (0–100) voor elke bijgehouden klant, op basis van wanneer ze voor het laatst actief waren, hoeveel functies ze gebruiken en hoeveel fouten ze tegenkomen. De score en de laatste 4 events verschijnen in de kaart Productgebruik bij elk ticket, zodat medewerkers elke conversatie goed geïnformeerd beginnen.',

    // SnippetTab
    saas_snippet_intro:                 'Kopieer de script-tag en plak die in jouw SaaS-product. Roep daarna {identify} aan na het inloggen en {track} op sleutelmomenten.',
    saas_snippet_script_label:          'Script-tag',
    saas_snippet_loading:               'Laden…',
    saas_snippet_example_label:         'Volledig voorbeeld',
    saas_snippet_events_label:          'Ondersteunde eventtypes',
    saas_token_label:                   'Jouw token:',
  },
}
