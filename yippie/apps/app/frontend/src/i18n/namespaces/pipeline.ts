// pipeline namespace — owned by the pipeline translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const pipeline: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // PipelinePage — header
    pipeline_title:                  'Kanban',
    pipeline_contacts_in_kanban:     '{count} contact in kanban',
    pipeline_contacts_in_kanban_pl:  '{count} contacts in kanban',
    pipeline_flowchart_desc:         'Describe how contacts flow through your pipeline',
    pipeline_manage_stages:          'Manage stages',
    // PipelinePage — tabs
    pipeline_tab_board:              'board',
    pipeline_tab_flowchart:          'flowchart',
    // PipelinePage — empty board
    pipeline_no_stages_title:        'No kanban stages yet',
    pipeline_no_stages_admin:        'Create stages to start tracking contacts through your kanban.',
    pipeline_no_stages_agent:        'Ask an admin to set up kanban stages.',
    pipeline_start_standard:         'Start with standard pipeline',
    pipeline_creating:               'Creating…',
    pipeline_custom_stage:           'Custom stage',
    // PipelinePage — mobile stage list
    pipeline_no_contacts_stage:      'No contacts in this stage',
    // PipelinePage — selection bar
    pipeline_selected:               '{count} selected',
    pipeline_drag_hint:              'Drag any selected card to move all',
    pipeline_send_booking:           'Send booking link',
    // PipelinePage — add contact button
    pipeline_add_contact:            'Add contact',
    // PipelinePage — contact card
    pipeline_follow_up:              'Follow up: {days} days in {stage}',
    pipeline_added_today:            'Added today',
    pipeline_one_day:                '1 day',
    pipeline_n_days:                 '{days} days',
    // PipelinePage — context menu
    pipeline_view_contact:           'View contact',
    pipeline_move_to_stage:          'Move to stage',
    pipeline_send_booking_ctx:       'Send booking link',
    pipeline_send_campaign_ctx:      'Send campaign',
    // StageModal
    pipeline_manage_title:           'Manage Kanban Stages',
    pipeline_no_stages_yet:          'No stages yet. Add one below.',
    pipeline_edit_stage:             'Edit stage',
    pipeline_new_stage:              'New stage',
    pipeline_stage_name_ph:          'Stage name…',
    pipeline_stage_color_title:      'Stage colour',
    pipeline_linked_campaign:        'Linked campaign',
    pipeline_none_option:            '— None —',
    pipeline_save_failed:            'Save failed',
    pipeline_update_btn:             'Update',
    pipeline_add_stage_btn:          'Add stage',
    pipeline_delete_stage_confirm:   'Delete "{name}"? Contacts will be removed from this stage.',
    // AddContactModal
    pipeline_search_contacts_ph:     'Search contacts…',
    pipeline_no_contacts_found:      'No contacts found',
    pipeline_all_in_kanban:          'All matching contacts are already in the kanban',
    // SendCampaignPopup
    pipeline_campaign_popup_title:   'Send campaign',
    pipeline_campaign_label:         'Campaign',
    pipeline_subject_label:          'Subject',
    pipeline_recipients_label:       'Recipients',
    pipeline_recipients_value:       'All contacts in {stage} ({count} contact)',
    pipeline_recipients_value_pl:    'All contacts in {stage} ({count} contacts)',
    pipeline_no_email_design:        'No email design saved yet.',
    pipeline_dispatches_desc:        'This dispatches immediately to all contacts in {stage}.',
    pipeline_cancel_btn:             'Cancel',
    pipeline_send_campaign_btn:      'Send campaign',
    pipeline_sending:                'Sending…',
    // PipelineFlowchart — empty canvas
    pipeline_flowchart_teach:        'Teach Yippie how your pipeline works',
    pipeline_flowchart_teach_desc:   'Lay out your stages, decisions and the arrows between them so Yippie understands how contacts should flow through the Kanban.',
    pipeline_start_from_stages:      'Start from your stages',
    // PipelineFlowchart — toolbar
    pipeline_add_label:              'Add',
    pipeline_stage_label:            'Stage',
    pipeline_decision_label:         'Decision',
    pipeline_start_label:            'Start',
    pipeline_end_label:              'End',
    pipeline_suggest_automations:    'Suggest automations',
    pipeline_unplaced_stages:        'Unplaced stages',
    pipeline_all_on_canvas:          'Every stage is on the canvas.',
    pipeline_save_btn:               'Save',
    // PipelineFlowchart — delete stage modal
    pipeline_delete_stage_title:     'Delete stage',
    pipeline_delete_stage_body:      'Delete the {name} stage? This removes it from the board, its cards lose this stage, and its node disappears from the flowchart. This cannot be undone.',
    pipeline_delete_stage_btn:       'Delete stage',
    // PipelineFlowchart — suggest automations modal
    pipeline_suggestions_title:      'Suggested automations',
    pipeline_suggestions_empty:      'Nothing to suggest yet',
    pipeline_suggestions_empty_desc: 'Draw arrows between your stages (directly, or through a decision) and Yippie will suggest automations that move contacts along for you.',
    pipeline_suggestions_intro:      'Turn the arrows you drew into automations. Each opens in Flows prefilled — review and enable it there.',
    pipeline_create_in_flows:        'Create in Flows',
    pipeline_close_btn:              'Close',
    // PipelineFlowchart — edge label modal
    pipeline_edge_label_title:       'Edit arrow label',
    pipeline_edge_label_tip:         'Tip: a single click selects the arrow — press Delete to remove it.',
    pipeline_delete_arrow:           'Delete arrow',
    pipeline_save_label:             'Save label',
    // PipelineFlowchart — context menus
    pipeline_add_here:               'Add here',
    pipeline_remove_from_chart:      'Remove from chart',
    pipeline_delete_stage_ctx:       'Delete stage',
    pipeline_edit_label_ctx:         'Edit label',
    pipeline_delete_arrow_ctx:       'Delete arrow',
    // StageNode
    pipeline_delete_stage_node_tip:  'Delete stage',
    pipeline_rename_tip:             'Double click to rename this stage',
    // DecisionNode
    pipeline_question_placeholder:   'Question?',
    pipeline_edit_question_tip:      'Double click to edit the question',
  },
  nl: {
    // PipelinePage — header
    pipeline_title:                  'Kanban',
    pipeline_contacts_in_kanban:     '{count} contact in kanban',
    pipeline_contacts_in_kanban_pl:  '{count} contacten in kanban',
    pipeline_flowchart_desc:         'Beschrijf hoe contacten door je pipeline stromen',
    pipeline_manage_stages:          'Fasen beheren',
    // PipelinePage — tabs
    pipeline_tab_board:              'bord',
    pipeline_tab_flowchart:          'stroomdiagram',
    // PipelinePage — empty board
    pipeline_no_stages_title:        'Nog geen kanbanborden',
    pipeline_no_stages_admin:        'Maak fasen aan om contacten door je kanban te volgen.',
    pipeline_no_stages_agent:        'Vraag een beheerder om kanbanborden in te stellen.',
    pipeline_start_standard:         'Beginnen met standaard pipeline',
    pipeline_creating:               'Aanmaken…',
    pipeline_custom_stage:           'Eigen fase',
    // PipelinePage — mobile stage list
    pipeline_no_contacts_stage:      'Geen contacten in deze fase',
    // PipelinePage — selection bar
    pipeline_selected:               '{count} geselecteerd',
    pipeline_drag_hint:              'Sleep een geselecteerde kaart om ze allemaal te verplaatsen',
    pipeline_send_booking:           'Boekingslink sturen',
    // PipelinePage — add contact button
    pipeline_add_contact:            'Contact toevoegen',
    // PipelinePage — contact card
    pipeline_follow_up:              'Opvolgen: {days} dagen in {stage}',
    pipeline_added_today:            'Vandaag toegevoegd',
    pipeline_one_day:                '1 dag',
    pipeline_n_days:                 '{days} dagen',
    // PipelinePage — context menu
    pipeline_view_contact:           'Contact bekijken',
    pipeline_move_to_stage:          'Verplaatsen naar fase',
    pipeline_send_booking_ctx:       'Boekingslink sturen',
    pipeline_send_campaign_ctx:      'Campagne versturen',
    // StageModal
    pipeline_manage_title:           'Kanbanfasen beheren',
    pipeline_no_stages_yet:          'Nog geen fasen. Voeg er hieronder een toe.',
    pipeline_edit_stage:             'Fase bewerken',
    pipeline_new_stage:              'Nieuwe fase',
    pipeline_stage_name_ph:          'Fasenaam…',
    pipeline_stage_color_title:      'Fasekleur',
    pipeline_linked_campaign:        'Gekoppelde campagne',
    pipeline_none_option:            '— Geen —',
    pipeline_save_failed:            'Opslaan mislukt',
    pipeline_update_btn:             'Bijwerken',
    pipeline_add_stage_btn:          'Fase toevoegen',
    pipeline_delete_stage_confirm:   '"{name}" verwijderen? Contacten worden uit deze fase verwijderd.',
    // AddContactModal
    pipeline_search_contacts_ph:     'Contacten zoeken…',
    pipeline_no_contacts_found:      'Geen contacten gevonden',
    pipeline_all_in_kanban:          'Alle overeenkomende contacten staan al in de kanban',
    // SendCampaignPopup
    pipeline_campaign_popup_title:   'Campagne versturen',
    pipeline_campaign_label:         'Campagne',
    pipeline_subject_label:          'Onderwerp',
    pipeline_recipients_label:       'Ontvangers',
    pipeline_recipients_value:       'Alle contacten in {stage} ({count} contact)',
    pipeline_recipients_value_pl:    'Alle contacten in {stage} ({count} contacten)',
    pipeline_no_email_design:        'Nog geen e-mailontwerp opgeslagen.',
    pipeline_dispatches_desc:        'Dit wordt direct verzonden naar alle contacten in {stage}.',
    pipeline_cancel_btn:             'Annuleren',
    pipeline_send_campaign_btn:      'Campagne versturen',
    pipeline_sending:                'Versturen…',
    // PipelineFlowchart — empty canvas
    pipeline_flowchart_teach:        'Leer Yippie hoe je pipeline werkt',
    pipeline_flowchart_teach_desc:   'Leg je fasen, beslissingen en de pijlen ertussen vast zodat Yippie begrijpt hoe contacten door de Kanban moeten stromen.',
    pipeline_start_from_stages:      'Beginnen met je fasen',
    // PipelineFlowchart — toolbar
    pipeline_add_label:              'Toevoegen',
    pipeline_stage_label:            'Fase',
    pipeline_decision_label:         'Beslissing',
    pipeline_start_label:            'Start',
    pipeline_end_label:              'Einde',
    pipeline_suggest_automations:    'Automatiseringen voorstellen',
    pipeline_unplaced_stages:        'Niet-geplaatste fasen',
    pipeline_all_on_canvas:          'Elke fase staat op het canvas.',
    pipeline_save_btn:               'Opslaan',
    // PipelineFlowchart — delete stage modal
    pipeline_delete_stage_title:     'Fase verwijderen',
    pipeline_delete_stage_body:      'Fase {name} verwijderen? Dit verwijdert het van het bord, de kaarten verliezen deze fase en het knooppunt verdwijnt uit het stroomdiagram. Dit kan niet ongedaan worden gemaakt.',
    pipeline_delete_stage_btn:       'Fase verwijderen',
    // PipelineFlowchart — suggest automations modal
    pipeline_suggestions_title:      'Voorgestelde automatiseringen',
    pipeline_suggestions_empty:      'Nog niets te suggereren',
    pipeline_suggestions_empty_desc: 'Teken pijlen tussen je fasen (direct, of via een beslissing) en Yippie stelt automatiseringen voor die contacten automatisch doorschuiven.',
    pipeline_suggestions_intro:      'Zet de getekende pijlen om in automatiseringen. Elke opent in Flows — bekijk en activeer ze daar.',
    pipeline_create_in_flows:        'Aanmaken in Flows',
    pipeline_close_btn:              'Sluiten',
    // PipelineFlowchart — edge label modal
    pipeline_edge_label_title:       'Pijllabel bewerken',
    pipeline_edge_label_tip:         'Tip: een enkele klik selecteert de pijl — druk op Delete om hem te verwijderen.',
    pipeline_delete_arrow:           'Pijl verwijderen',
    pipeline_save_label:             'Label opslaan',
    // PipelineFlowchart — context menus
    pipeline_add_here:               'Hier toevoegen',
    pipeline_remove_from_chart:      'Uit diagram verwijderen',
    pipeline_delete_stage_ctx:       'Fase verwijderen',
    pipeline_edit_label_ctx:         'Label bewerken',
    pipeline_delete_arrow_ctx:       'Pijl verwijderen',
    // StageNode
    pipeline_delete_stage_node_tip:  'Fase verwijderen',
    pipeline_rename_tip:             'Dubbelklik om deze fase een nieuwe naam te geven',
    // DecisionNode
    pipeline_question_placeholder:   'Vraag?',
    pipeline_edit_question_tip:      'Dubbelklik om de vraag te bewerken',
  },
}
