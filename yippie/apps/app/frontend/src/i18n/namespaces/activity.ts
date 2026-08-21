// activity namespace — owned by the activity translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const activity: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // ActivityFeed — page header
    activity_title:              'Activity',
    // ActivityFeed — tabs
    activity_tab_overview:       'overview',
    activity_tab_users:          'users',
    activity_tab_automation:     'automation',
    // ActivityFeed — load error
    activity_load_error:         'Could not load activity data. Please refresh.',
    // ActivityFeed — overview: Pipeline section
    activity_pipeline_heading:   'Pipeline',
    activity_no_stages:          'No pipeline stages yet',
    activity_avg_days:           'avg days in stage',
    activity_avg_n_days:         'avg {n} days in stage',
    // ActivityFeed — overview: Email section
    activity_email_heading:      'Email',
    activity_open_rate:          'Open rate',
    activity_emails_opened:      '{opened} of {total} emails opened',
    activity_sent_this_week:     'Sent this week',
    activity_delivered:          'Delivered',
    activity_opened:             'Opened',
    activity_bounced:            'Bounced',
    // ActivityFeed — overview: Tickets section
    activity_tickets_heading:    'Tickets',
    activity_open:               'Open',
    activity_in_progress:        'In progress',
    activity_resolved_this_week: 'Resolved this week',
    activity_avg_resolution_h:   'Avg resolution (hours)',
    // ActivityFeed — overview: Contacts section
    activity_contacts_heading:   'Contacts',
    activity_total_contacts:     'Total contacts',
    activity_new_this_week:      'New this week',
    // ActivityFeed — overview: Recent activity section
    activity_recent_heading:     'Recent activity',
    activity_no_activity:        'No activity to show',
    activity_all_filter:         'All',
    activity_system:             'System',
    activity_prev_btn:           '← Prev',
    activity_next_btn:           'Next →',
    // UsersTab — intro text
    activity_users_intro:        'Team activity over the last {days} days; arrows compare with the prior {days}. Numbers are per user; shared inbox rolls up by department below.',
    // UsersTab — user section
    activity_user_heading:       'User',
    activity_no_users:           'No users to show',
    activity_never_signed_in:    'never signed in',
    activity_active_ago:         'active {ago}',
    // UsersTab — hero metrics
    activity_first_response:     'First response',
    activity_first_response_sub: 'avg to first reply',
    activity_first_time_right:   'First time right',
    activity_reopened_sub:       '{count} reopened',
    activity_avg_resolution:     'Avg resolution',
    activity_resolution_sub:     'created to resolved',
    activity_open_workload:      'Open workload',
    activity_workload_sub:       'assigned right now',
    // UsersTab — stat labels
    activity_time_to_open_shared:    'Time to open (shared)',
    activity_shared_inbox_sub:       'shared inbox',
    activity_time_to_open_personal:  'Time to open (personal)',
    activity_own_mailbox_sub:        'own mailbox',
    activity_emails_received:        'Emails received',
    activity_personal_mailbox_sub:   'personal mailbox',
    activity_email_open_rate:        'Open rate',
    activity_chats_handled:          'Chats handled',
    activity_chats_solved:           'Chats solved',
    // UsersTab — spark cards
    activity_spark_activity:         'Activity',
    activity_spark_tickets_resolved: 'Tickets resolved',
    activity_spark_tickets_created:  'Tickets created',
    activity_spark_emails_sent:      'Emails sent',
    // UsersTab — delta chip
    activity_no_change:              'no change',
    // UsersTab — team comparison
    activity_team_comparison:        'Team comparison',
    activity_compare_resolved:       'Tickets resolved',
    activity_compare_open:           'Open workload',
    activity_compare_emails:         'Emails sent',
    activity_compare_response:       'First response',
    // UsersTab — recent activity timeline
    activity_recent_activity:        'Recent activity',
    activity_no_activity_period:     'No activity in this period',
    // UsersTab — department section
    activity_dept_heading:           'Department statistics',
    activity_shared_inbox:           'Shared inbox:',
    activity_received:               'received',
    activity_to_open:                'to open',
    activity_no_departments:         'No departments yet',
    activity_dept_col:               'Department',
    activity_members_col:            'Members',
    activity_created_col:            'Created',
    activity_open_col:               'Open',
    activity_resolved_col:           'Resolved',
    activity_avg_resolution_col:     'Avg resolution',
    // AutomationTab — intro
    activity_automation_intro:       'How your automations performed over the last {days} days.',
    // AutomationTab — section
    activity_flows_heading:          'Flows',
    activity_fires_label:            'Fires',
    activity_fires_sub:              'runs that did something',
    activity_success_rate_label:     'Success rate',
    activity_hours_saved_label:      'Est. hours saved',
    activity_hours_saved_sub:        '~3 min per run',
    activity_failed_label:           'Failed',
    activity_no_flows:               'No flows yet',
    // AutomationTab — table headers
    activity_col_flow:               'Flow',
    activity_col_health:             'Health',
    activity_col_fires:              'Fires',
    activity_col_success:            'Success',
    activity_col_skipped:            'Skipped',
    activity_col_saved:              'Saved',
    activity_col_last_run:           'Last run',
    activity_flow_off:               '(off)',
  },
  nl: {
    // ActivityFeed — page header
    activity_title:              'Activiteit',
    // ActivityFeed — tabs
    activity_tab_overview:       'overzicht',
    activity_tab_users:          'gebruikers',
    activity_tab_automation:     'automatisering',
    // ActivityFeed — load error
    activity_load_error:         'Activiteitsgegevens konden niet worden geladen. Ververs de pagina.',
    // ActivityFeed — overview: Pipeline section
    activity_pipeline_heading:   'Pipeline',
    activity_no_stages:          'Nog geen pipelinefasen',
    activity_avg_days:           'gem. dagen in fase',
    activity_avg_n_days:         'gem. {n} dagen in fase',
    // ActivityFeed — overview: Email section
    activity_email_heading:      'E-mail',
    activity_open_rate:          'Openingsrate',
    activity_emails_opened:      '{opened} van {total} e-mails geopend',
    activity_sent_this_week:     'Deze week verzonden',
    activity_delivered:          'Afgeleverd',
    activity_opened:             'Geopend',
    activity_bounced:            'Teruggestuurd',
    // ActivityFeed — overview: Tickets section
    activity_tickets_heading:    'Tickets',
    activity_open:               'Open',
    activity_in_progress:        'In behandeling',
    activity_resolved_this_week: 'Deze week opgelost',
    activity_avg_resolution_h:   'Gem. afhandeling (uren)',
    // ActivityFeed — overview: Contacts section
    activity_contacts_heading:   'Contacten',
    activity_total_contacts:     'Totaal contacten',
    activity_new_this_week:      'Deze week nieuw',
    // ActivityFeed — overview: Recent activity section
    activity_recent_heading:     'Recente activiteit',
    activity_no_activity:        'Geen activiteit om te tonen',
    activity_all_filter:         'Alles',
    activity_system:             'Systeem',
    activity_prev_btn:           '← Vorige',
    activity_next_btn:           'Volgende →',
    // UsersTab — intro text
    activity_users_intro:        'Teamactiviteit over de afgelopen {days} dagen; pijlen vergelijken met de vorige {days}. Cijfers zijn per gebruiker; gedeelde inbox wordt hieronder per afdeling samengevat.',
    // UsersTab — user section
    activity_user_heading:       'Gebruiker',
    activity_no_users:           'Geen gebruikers om te tonen',
    activity_never_signed_in:    'nooit ingelogd',
    activity_active_ago:         'actief {ago}',
    // UsersTab — hero metrics
    activity_first_response:     'Eerste reactie',
    activity_first_response_sub: 'gem. tijd tot eerste reactie',
    activity_first_time_right:   'Eerste keer goed',
    activity_reopened_sub:       '{count} heropend',
    activity_avg_resolution:     'Gem. afhandeling',
    activity_resolution_sub:     'aangemaakt tot opgelost',
    activity_open_workload:      'Open werkdruk',
    activity_workload_sub:       'momenteel toegewezen',
    // UsersTab — stat labels
    activity_time_to_open_shared:    'Opentijd (gedeeld)',
    activity_shared_inbox_sub:       'gedeelde inbox',
    activity_time_to_open_personal:  'Opentijd (persoonlijk)',
    activity_own_mailbox_sub:        'eigen postvak',
    activity_emails_received:        'E-mails ontvangen',
    activity_personal_mailbox_sub:   'persoonlijk postvak',
    activity_email_open_rate:        'Openingsrate',
    activity_chats_handled:          'Chats afgehandeld',
    activity_chats_solved:           'Chats opgelost',
    // UsersTab — spark cards
    activity_spark_activity:         'Activiteit',
    activity_spark_tickets_resolved: 'Tickets opgelost',
    activity_spark_tickets_created:  'Tickets aangemaakt',
    activity_spark_emails_sent:      'E-mails verzonden',
    // UsersTab — delta chip
    activity_no_change:              'geen wijziging',
    // UsersTab — team comparison
    activity_team_comparison:        'Teamvergelijking',
    activity_compare_resolved:       'Tickets opgelost',
    activity_compare_open:           'Open werkdruk',
    activity_compare_emails:         'E-mails verzonden',
    activity_compare_response:       'Eerste reactie',
    // UsersTab — recent activity timeline
    activity_recent_activity:        'Recente activiteit',
    activity_no_activity_period:     'Geen activiteit in deze periode',
    // UsersTab — department section
    activity_dept_heading:           'Afdelingsstatistieken',
    activity_shared_inbox:           'Gedeelde inbox:',
    activity_received:               'ontvangen',
    activity_to_open:                'tot openen',
    activity_no_departments:         'Nog geen afdelingen',
    activity_dept_col:               'Afdeling',
    activity_members_col:            'Leden',
    activity_created_col:            'Aangemaakt',
    activity_open_col:               'Open',
    activity_resolved_col:           'Opgelost',
    activity_avg_resolution_col:     'Gem. afhandeling',
    // AutomationTab — intro
    activity_automation_intro:       'Hoe je automatiseringen de afgelopen {days} dagen hebben gepresteerd.',
    // AutomationTab — section
    activity_flows_heading:          'Flows',
    activity_fires_label:            'Activaties',
    activity_fires_sub:              'uitvoeringen die iets deden',
    activity_success_rate_label:     'Slaagpercentage',
    activity_hours_saved_label:      'Ges. uren bespaard',
    activity_hours_saved_sub:        '~3 min per uitvoering',
    activity_failed_label:           'Mislukt',
    activity_no_flows:               'Nog geen flows',
    // AutomationTab — table headers
    activity_col_flow:               'Flow',
    activity_col_health:             'Status',
    activity_col_fires:              'Activaties',
    activity_col_success:            'Geslaagd',
    activity_col_skipped:            'Overgeslagen',
    activity_col_saved:              'Bespaard',
    activity_col_last_run:           'Laatste uitvoering',
    activity_flow_off:               '(uit)',
  },
}
