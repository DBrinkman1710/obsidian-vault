// contracts namespace — owned by the contracts translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const contracts: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // Page header
    contract_page_title:              'Contracts',
    contract_view_all:                'All',
    contract_view_renewals:           'Renewals',
    contract_btn_new:                 'New Contract',
    contract_btn_templates:           'Templates',

    // Filter bar
    contract_search_ph:               'Search by title, counterparty, or type…',
    contract_dir_all:                 'All',
    contract_dir_issued:              'We issue',
    contract_dir_received:            'We receive',

    // Table headers
    contract_col_title:               'Title',
    contract_col_counterparty:        'Counterparty',
    contract_col_type:                'Type',
    contract_col_status:              'Status',
    contract_col_end_date:            'End date',
    contract_col_value:               'Value',
    contract_col_file:                'File',

    // Status options
    contract_status_draft:            'Draft',
    contract_status_sent:             'Sent',
    contract_status_active:           'Active',
    contract_status_expired:          'Expired',
    contract_status_terminated:       'Terminated',

    // Direction options
    contract_direction_issued:        'We issue',
    contract_direction_received:      'We receive',

    // Value interval options
    contract_interval_none:           'No value',
    contract_interval_one_off:        'One off',
    contract_interval_monthly:        'Per month',
    contract_interval_yearly:         'Per year',

    // Renewal term options
    contract_renewal_yearly:          '1 year',
    contract_renewal_monthly:         '1 month',

    // Empty states
    contract_empty_title:             'No contracts yet',
    contract_empty_subtitle:          'Add your first contract to track renewals, value and e-signing in one place.',
    contract_empty_search_title:      'No matching contracts',
    contract_empty_search_subtitle:   'Try a different title or counterparty.',

    // Renewals view
    contract_renewals_mrr:            'Contracted MRR',
    contract_renewals_arr:            'Contracted ARR',
    contract_renewals_one_off:        'One off value',
    contract_renewals_active_count:   'Active contracts',
    contract_renewals_expiring_title: 'Expiring soon',
    contract_renewals_auto_title:     'Auto renewing',
    contract_renewals_expired_title:  'Expired',
    contract_renewals_expiring_empty: 'Nothing due in the next 60 days.',
    contract_renewals_auto_empty:     'No contracts set to auto renew.',
    contract_renewals_expired_empty:  'No expired contracts.',

    // Add modal
    contract_add_title:               'New Contract',
    contract_add_doc_label:           'Document (optional)',
    contract_add_doc_hint:            'Click to attach a PDF, Word doc, or image',
    contract_add_saving:              'Saving…',
    contract_add_submit:              'Create contract',
    contract_add_cancel:              'Cancel',
    contract_add_error_title:         'Title is required',
    contract_add_error_generic:       'Failed to create contract',

    // Edit / peek modal
    contract_peek_title:              'Contract',
    contract_peek_loading:            'Loading…',
    contract_peek_save:               'Save changes',
    contract_peek_saving:             'Saving…',
    contract_peek_close:              'Close',
    contract_peek_error_title:        'Title is required',
    contract_peek_doc_label:          'Document',
    contract_peek_doc_download:       'Download',
    contract_peek_doc_remove:         'Remove',
    contract_peek_doc_uploading:      'Uploading…',
    contract_peek_doc_attach:         'Click to attach a document',

    // Form fields
    contract_field_title:             'Title *',
    contract_field_type:              'Type',
    contract_field_type_ph:           'Service, NDA, SLA…',
    contract_field_direction:         'Direction',
    contract_field_status:            'Status',
    contract_field_counterparty:      'Counterparty name',
    contract_field_counterparty_ph:   'Free text (optional)',
    contract_field_company:           'Company',
    contract_field_contact:           'Contact',
    contract_field_term_value:        'Term & value',
    contract_field_start_date:        'Start date',
    contract_field_end_date:          'End date',
    contract_field_notice_period:     'Notice period (days)',
    contract_field_renewal:           'Renewal',
    contract_field_auto_renew:        'Auto renew',
    contract_field_value:             'Value (€)',
    contract_field_billing_interval:  'Billing interval',
    contract_field_notes:             'Notes',
    contract_field_notes_ph:          'Key terms, notice period, value…',

    // Typeahead
    contract_search_contact_ph:       'Search a contact…',
    contract_search_company_ph:       'Search a company…',

    // Signing section
    contract_signing_label:           'Contract text & signing',
    contract_signing_signed_by:       'Signed by',
    contract_signing_signed_on:       'on',
    contract_signing_choose_template: 'Choose a template…',
    contract_signing_generating:      'Generating…',
    contract_signing_generate:        'Generate',
    contract_signing_cancel:          'Cancel',
    contract_signing_save_text:       'Save text',
    contract_signing_saving:          'Saving…',
    contract_signing_pdf:             'PDF',
    contract_signing_copy_link:       'Copy signing link',
    contract_signing_create_link:     'Create signing link',
    contract_signing_creating:        'Creating…',
    contract_signing_regenerate:      'Regenerate',
    contract_signing_generated:       'Contract text generated',
    contract_signing_text_saved:      'Contract text saved',
    contract_signing_link_copied:     'Signing link copied to clipboard — valid 14 days',

    // Delete modal
    contract_delete_title:            'Delete contracts',
    contract_delete_body:             'Delete {n} contract(s)? This cannot be undone.',
    contract_delete_deleting:         'Deleting…',
    contract_delete_btn:              'Delete',
    contract_delete_cancel:           'Cancel',

    // Templates modal
    contract_tpl_title:               'Contract templates',
    contract_tpl_name_ph:             'e.g. Service agreement',
    contract_tpl_creating:            'Creating…',
    contract_tpl_create:              'Create',
    contract_tpl_edit:                'Edit layout',
    contract_tpl_empty:               'No templates yet. Create your first one and design it in the builder.',

    // Context menu / toasts
    contract_ctx_download_file:       'Download file',
    contract_ctx_delete:              'Delete',
    contract_toast_created:           'Contract created',
    contract_toast_saved:             'Saved',
    contract_toast_attached:          'Document attached',
    contract_toast_removed:           'Document removed',
    contract_toast_deleted:           '{n} contract(s) deleted',
    contract_toast_status_failed:     'Status update failed',
    contract_toast_tpl_deleted:       'Template deleted',
    contract_toast_download_failed:   'Download failed',
    contract_download_file:           'Download file',
    contract_toast_pdf_failed:        'PDF download failed',
    contract_toast_bulk_failed:       'Failed to delete contracts',
    contract_toast_save_failed:       'Save failed',
    contract_toast_upload_failed:     'Upload failed',
    contract_toast_gen_failed:        'Generation failed',
    contract_toast_link_failed:       'Could not create signing link',
    contract_toast_tpl_create_failed: 'Failed to create template',
  },
  nl: {
    // Page header
    contract_page_title:              'Contracten',
    contract_view_all:                'Alle',
    contract_view_renewals:           'Verlengingen',
    contract_btn_new:                 'Nieuw contract',
    contract_btn_templates:           'Sjablonen',

    // Filter bar
    contract_search_ph:               'Zoek op titel, wederpartij of type…',
    contract_dir_all:                 'Alle',
    contract_dir_issued:              'Wij versturen',
    contract_dir_received:            'Wij ontvangen',

    // Table headers
    contract_col_title:               'Titel',
    contract_col_counterparty:        'Wederpartij',
    contract_col_type:                'Type',
    contract_col_status:              'Status',
    contract_col_end_date:            'Einddatum',
    contract_col_value:               'Waarde',
    contract_col_file:                'Bestand',

    // Status options
    contract_status_draft:            'Concept',
    contract_status_sent:             'Verstuurd',
    contract_status_active:           'Actief',
    contract_status_expired:          'Verlopen',
    contract_status_terminated:       'Beëindigd',

    // Direction options
    contract_direction_issued:        'Wij versturen',
    contract_direction_received:      'Wij ontvangen',

    // Value interval options
    contract_interval_none:           'Geen waarde',
    contract_interval_one_off:        'Eenmalig',
    contract_interval_monthly:        'Per maand',
    contract_interval_yearly:         'Per jaar',

    // Renewal term options
    contract_renewal_yearly:          '1 jaar',
    contract_renewal_monthly:         '1 maand',

    // Empty states
    contract_empty_title:             'Nog geen contracten',
    contract_empty_subtitle:          'Voeg je eerste contract toe om verlengingen, waarde en e-ondertekening op één plek bij te houden.',
    contract_empty_search_title:      'Geen overeenkomende contracten',
    contract_empty_search_subtitle:   'Probeer een andere titel of wederpartij.',

    // Renewals view
    contract_renewals_mrr:            'Gecontracteerde MRR',
    contract_renewals_arr:            'Gecontracteerde ARR',
    contract_renewals_one_off:        'Eenmalige waarde',
    contract_renewals_active_count:   'Actieve contracten',
    contract_renewals_expiring_title: 'Verloopt binnenkort',
    contract_renewals_auto_title:     'Automatisch verlengd',
    contract_renewals_expired_title:  'Verlopen',
    contract_renewals_expiring_empty: 'Niets vervalt in de komende 60 dagen.',
    contract_renewals_auto_empty:     'Geen contracten ingesteld op automatische verlenging.',
    contract_renewals_expired_empty:  'Geen verlopen contracten.',

    // Add modal
    contract_add_title:               'Nieuw contract',
    contract_add_doc_label:           'Document (optioneel)',
    contract_add_doc_hint:            'Klik om een PDF, Word-document of afbeelding toe te voegen',
    contract_add_saving:              'Opslaan…',
    contract_add_submit:              'Contract aanmaken',
    contract_add_cancel:              'Annuleren',
    contract_add_error_title:         'Titel is verplicht',
    contract_add_error_generic:       'Aanmaken van contract mislukt',

    // Edit / peek modal
    contract_peek_title:              'Contract',
    contract_peek_loading:            'Laden…',
    contract_peek_save:               'Wijzigingen opslaan',
    contract_peek_saving:             'Opslaan…',
    contract_peek_close:              'Sluiten',
    contract_peek_error_title:        'Titel is verplicht',
    contract_peek_doc_label:          'Document',
    contract_peek_doc_download:       'Downloaden',
    contract_peek_doc_remove:         'Verwijderen',
    contract_peek_doc_uploading:      'Uploaden…',
    contract_peek_doc_attach:         'Klik om een document toe te voegen',

    // Form fields
    contract_field_title:             'Titel *',
    contract_field_type:              'Type',
    contract_field_type_ph:           'Service, NDA, SLA…',
    contract_field_direction:         'Richting',
    contract_field_status:            'Status',
    contract_field_counterparty:      'Naam wederpartij',
    contract_field_counterparty_ph:   'Vrije tekst (optioneel)',
    contract_field_company:           'Bedrijf',
    contract_field_contact:           'Contact',
    contract_field_term_value:        'Looptijd & waarde',
    contract_field_start_date:        'Startdatum',
    contract_field_end_date:          'Einddatum',
    contract_field_notice_period:     'Opzegtermijn (dagen)',
    contract_field_renewal:           'Verlenging',
    contract_field_auto_renew:        'Automatisch verlengen',
    contract_field_value:             'Waarde (€)',
    contract_field_billing_interval:  'Factureringsperiode',
    contract_field_notes:             'Notities',
    contract_field_notes_ph:          'Kernvoorwaarden, opzegtermijn, waarde…',

    // Typeahead
    contract_search_contact_ph:       'Zoek een contact…',
    contract_search_company_ph:       'Zoek een bedrijf…',

    // Signing section
    contract_signing_label:           'Contracttekst & ondertekening',
    contract_signing_signed_by:       'Ondertekend door',
    contract_signing_signed_on:       'op',
    contract_signing_choose_template: 'Kies een sjabloon…',
    contract_signing_generating:      'Genereren…',
    contract_signing_generate:        'Genereren',
    contract_signing_cancel:          'Annuleren',
    contract_signing_save_text:       'Tekst opslaan',
    contract_signing_saving:          'Opslaan…',
    contract_signing_pdf:             'PDF',
    contract_signing_copy_link:       'Ondertekeningslink kopiëren',
    contract_signing_create_link:     'Ondertekeningslink aanmaken',
    contract_signing_creating:        'Aanmaken…',
    contract_signing_regenerate:      'Opnieuw genereren',
    contract_signing_generated:       'Contracttekst gegenereerd',
    contract_signing_text_saved:      'Contracttekst opgeslagen',
    contract_signing_link_copied:     'Ondertekeningslink gekopieerd — geldig 14 dagen',

    // Delete modal
    contract_delete_title:            'Contracten verwijderen',
    contract_delete_body:             '{n} contract(en) verwijderen? Dit kan niet ongedaan worden gemaakt.',
    contract_delete_deleting:         'Verwijderen…',
    contract_delete_btn:              'Verwijderen',
    contract_delete_cancel:           'Annuleren',

    // Templates modal
    contract_tpl_title:               'Contractsjablonen',
    contract_tpl_name_ph:             'bijv. Serviceovereenkomst',
    contract_tpl_creating:            'Aanmaken…',
    contract_tpl_create:              'Aanmaken',
    contract_tpl_edit:                'Indeling bewerken',
    contract_tpl_empty:               'Nog geen sjablonen. Maak je eerste aan en ontwerp het in de builder.',

    // Context menu / toasts
    contract_ctx_download_file:       'Bestand downloaden',
    contract_ctx_delete:              'Verwijderen',
    contract_toast_created:           'Contract aangemaakt',
    contract_toast_saved:             'Opgeslagen',
    contract_toast_attached:          'Document toegevoegd',
    contract_toast_removed:           'Document verwijderd',
    contract_toast_deleted:           '{n} contract(en) verwijderd',
    contract_toast_status_failed:     'Statuswijziging mislukt',
    contract_toast_tpl_deleted:       'Sjabloon verwijderd',
    contract_toast_download_failed:   'Downloaden mislukt',
    contract_download_file:           'Bestand downloaden',
    contract_toast_pdf_failed:        'PDF downloaden mislukt',
    contract_toast_bulk_failed:       'Verwijderen van contracten mislukt',
    contract_toast_save_failed:       'Opslaan mislukt',
    contract_toast_upload_failed:     'Uploaden mislukt',
    contract_toast_gen_failed:        'Genereren mislukt',
    contract_toast_link_failed:       'Ondertekeningslink aanmaken mislukt',
    contract_toast_tpl_create_failed: 'Sjabloon aanmaken mislukt',
  },
}
