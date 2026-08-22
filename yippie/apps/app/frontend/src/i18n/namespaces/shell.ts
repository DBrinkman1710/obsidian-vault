// shell namespace — owned by the shell translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const shell: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // Sidebar — account button
    shell_account:                  'Account',
    // Sidebar — drag-to-reorder
    shell_drag_to_reorder:          'Drag to reorder',
    shell_reorder_sidebar:          'Reorder sidebar',
    shell_reorder_saving:           'Saving…',
    shell_reorder_done:             'Done',
    shell_reorder_cancel:           'Cancel',
    shell_reorder_save_failed:      'Failed to save sidebar order',
    // Sidebar — inbox status dot
    shell_inbox_refreshing:         'Refreshing…',
    shell_inbox_idle:               'Idle',
    // Sidebar — collapse toggle
    shell_expand_sidebar:           'Expand sidebar',
    shell_collapse_sidebar:         'Collapse sidebar',
    // Sidebar — account popover
    shell_team:                     'Team',
    shell_clients:                  'Clients',
    shell_superadmins:              'Superadmins',
    shell_replay_tour:              'Replay welcome tour',
    shell_tour_restart_failed:      'Could not restart the tour',
    // CloseButton
    shell_close:                    'Close',
    // ModuleGate — locked card
    shell_module_not_on:            "isn't switched on",
    shell_module_not_in_plan:       "isn't part of your workspace yet. Add it to your plan to unlock it for your whole team.",
    shell_upgrade_plan:             'Upgrade plan',
    shell_addon_question:           'Need it as an à la carte add-on?',
    shell_contact_us:               'Contact us',
    // DesktopOnly
    shell_desktop_only_title:       'Best on desktop',
    shell_desktop_only_desc:        'This feature is designed for larger screens. Open Yippie on your computer to access it.',
    // BottomNav
    shell_settings:                 'Settings',
    // App — config error
    shell_workspace_load_error:     "Couldn't load your workspace.",
    shell_retry:                    'Retry',
    // App — loading
    shell_loading:                  'Loading…',
    // App — impersonation banner
    shell_impersonating_viewing_as: 'Viewing as',
    shell_impersonating_exit:       'Exit',
    // App — trial banner
    shell_trial_days_left:          'Free trial: {days} {unit} left.',
    shell_trial_urgent:             'Your free trial ends in {days} {unit}. Your contacts, tickets and settings stay when you upgrade.',
    shell_trial_upgrade_now:        'Upgrade now',
    shell_trial_day:                'day',
    shell_trial_days:               'days',
    // App — demo banner
    shell_demo_no_expiry:           'Demo environment. Data may be reset at any time.',
    shell_demo_contact_support:     'Contact support',
    shell_demo_go_live:             'to go live.',
    shell_demo_ended:               'Your demo has ended. Your setup is still here.',
    shell_demo_ends_on:             'Your demo ends {deadline}. Everything you build stays when you go live.',
    shell_demo_keep_it:             'to keep it.',
    // App — AI scans toast
    shell_ai_scans_used:            "You've used {pct}% of your AI scans this month",
    shell_ai_scans_desc:            'When they run out, incoming messages stop getting auto-drafted until next month.',
    shell_ai_scans_upgrade:         'Upgrade',
    shell_ai_scans_risk:            "I'll risk it",
    // App — overdue tickets toast
    shell_overdue_ticket:           'overdue ticket needs attention',
    shell_overdue_tickets:          'overdue tickets need attention',
    shell_overdue_view:             'View',
    // main.tsx — error boundary
    shell_error_title:              'Something went wrong',
    shell_error_desc:               'The error has been reported. Please reload the page.',
    shell_error_reload:             'Reload',
  },
  nl: {
    // Sidebar — account button
    shell_account:                  'Account',
    // Sidebar — drag-to-reorder
    shell_drag_to_reorder:          'Slepen om te herordenen',
    shell_reorder_sidebar:          'Zijbalk herordenen',
    shell_reorder_saving:           'Opslaan…',
    shell_reorder_done:             'Klaar',
    shell_reorder_cancel:           'Annuleren',
    shell_reorder_save_failed:      'Opslaan van volgorde mislukt',
    // Sidebar — inbox status dot
    shell_inbox_refreshing:         'Vernieuwen…',
    shell_inbox_idle:               'Inactief',
    // Sidebar — collapse toggle
    shell_expand_sidebar:           'Zijbalk uitvouwen',
    shell_collapse_sidebar:         'Zijbalk invouwen',
    // Sidebar — account popover
    shell_team:                     'Team',
    shell_clients:                  'Klanten',
    shell_superadmins:              'Superadmins',
    shell_replay_tour:              'Welkomsttour opnieuw starten',
    shell_tour_restart_failed:      'Tour opnieuw starten mislukt',
    // CloseButton
    shell_close:                    'Sluiten',
    // ModuleGate — locked card
    shell_module_not_on:            'staat niet aan',
    shell_module_not_in_plan:       'maakt nog geen deel uit van je werkruimte. Voeg het toe aan je abonnement om het voor je hele team te activeren.',
    shell_upgrade_plan:             'Abonnement upgraden',
    shell_addon_question:           'Wil je het als losse toevoeging?',
    shell_contact_us:               'Neem contact op',
    // DesktopOnly
    shell_desktop_only_title:       'Beste ervaring op desktop',
    shell_desktop_only_desc:        'Deze functie is ontworpen voor grotere schermen. Open Yippie op je computer om het te gebruiken.',
    // BottomNav
    shell_settings:                 'Instellingen',
    // App — config error
    shell_workspace_load_error:     'Je werkruimte kon niet worden geladen.',
    shell_retry:                    'Opnieuw proberen',
    // App — loading
    shell_loading:                  'Laden…',
    // App — impersonation banner
    shell_impersonating_viewing_as: 'Je bekijkt als',
    shell_impersonating_exit:       'Afsluiten',
    // App — trial banner
    shell_trial_days_left:          'Gratis proefperiode: nog {days} {unit} over.',
    shell_trial_urgent:             'Je gratis proefperiode eindigt over {days} {unit}. Je contacten, tickets en instellingen blijven bewaard als je upgradet.',
    shell_trial_upgrade_now:        'Nu upgraden',
    shell_trial_day:                'dag',
    shell_trial_days:               'dagen',
    // App — demo banner
    shell_demo_no_expiry:           'Demoversie. Gegevens kunnen op elk moment worden gereset.',
    shell_demo_contact_support:     'Neem contact op met support',
    shell_demo_go_live:             'om live te gaan.',
    shell_demo_ended:               'Je demo is afgelopen. Je instellingen staan er nog.',
    shell_demo_ends_on:             'Je demo eindigt op {deadline}. Alles wat je hebt gebouwd blijft bewaard als je live gaat.',
    shell_demo_keep_it:             'om alles te bewaren.',
    // App — AI scans toast
    shell_ai_scans_used:            'Je hebt {pct}% van je AI-scans deze maand gebruikt',
    shell_ai_scans_desc:            'Als ze op zijn, worden inkomende berichten niet meer automatisch opgesteld tot volgende maand.',
    shell_ai_scans_upgrade:         'Upgraden',
    shell_ai_scans_risk:            'Ik neem het risico',
    // App — overdue tickets toast
    shell_overdue_ticket:           'verlopen ticket heeft aandacht nodig',
    shell_overdue_tickets:          'verlopen tickets hebben aandacht nodig',
    shell_overdue_view:             'Bekijken',
    // main.tsx — error boundary
    shell_error_title:              'Er is iets misgegaan',
    shell_error_desc:               'De fout is gemeld. Laad de pagina opnieuw.',
    shell_error_reload:             'Opnieuw laden',
  },
}
