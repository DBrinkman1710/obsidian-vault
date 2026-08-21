// billing namespace — owned by the billing translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const billing: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // Shared status labels (used in select dropdowns and status cells)
    invoice_draft:              'Draft',
    invoice_pending:            'Pending',
    invoice_sent:               'Sent',
    invoice_received:           'Received',
    invoice_paid:               'Paid',
    invoice_overdue:            'Overdue',
    invoice_void:               'Void',
    invoice_not_sent:           'Not Sent',

    // Page header — InvoiceList
    billing_page_title:         'Invoices',
    billing_overdue_badge:      '{n} overdue',
    billing_btn_export:         'Export',
    billing_btn_import:         'Import',
    billing_btn_templates:      'Templates',
    billing_btn_new:            'New Invoice',

    // Search
    billing_search_ph:          'Search by invoice # or contact…',

    // Bulk bar actions
    billing_bulk_export_pdf:    'Export PDF',
    billing_bulk_export_csv:    'Export CSV',
    billing_bulk_send:          'Send',
    billing_bulk_delete:        'Delete',

    // Table headers
    billing_col_number:         'Invoice #',
    billing_col_contact:        'Contact',
    billing_col_status:         'Status',
    billing_col_amount:         'Amount',
    billing_col_due_date:       'Due date',

    // Table cells
    billing_concept:            'Concept',

    // Empty states
    billing_empty_title:        'No invoices yet',
    billing_empty_subtitle:     'Create your first invoice to start tracking what you’re owed.',
    billing_empty_search_title: 'No matching invoices',
    billing_empty_search_sub:   'Try a different invoice number or contact.',
    billing_empty_cta:          'New invoice',

    // Context menu
    billing_ctx_export_pdf:     'Export PDF',
    billing_ctx_export_csv:     'Export CSV',
    billing_ctx_send_email:     'Send by email',
    billing_ctx_delete:         'Delete',

    // Add Invoice Modal
    billing_add_title:          'New Invoice',
    billing_add_contact_label:  'Contact / Company *',
    billing_add_contact_ph:     'Search contact or company…',
    billing_add_items_label:    'Line items',
    billing_add_item_desc_ph:   'Service or product description',
    billing_add_item_desc_col:  'Description',
    billing_add_item_qty_col:   'Qty',
    billing_add_item_price_col: 'Price excl.',
    billing_add_item_vat_col:   'VAT %',
    billing_add_line_btn:       'Add line',
    billing_add_subtotal:       'Subtotal excl. VAT',
    billing_add_total_incl:     'Total incl. VAT',
    billing_add_vat_row:        'VAT {rate}%',
    billing_add_invoice_date:   'Invoice date',
    billing_add_due_date:       'Due date',
    billing_add_currency:       'Currency',
    billing_add_status:         'Status',
    billing_add_template:       'Template',
    billing_add_template_std:   'Standard layout',
    billing_add_template_def:   '(default)',
    billing_add_notes_label:    'Payment info / Notes',
    billing_add_notes_ph:       'E.g. IBAN NL12 BANK 0123 4567 89. Payment within 30 days.',
    billing_add_error_contact:  'Select a contact',
    billing_add_error_items:    'Add at least one line item',
    billing_add_saving:         'Saving…',
    billing_add_submit:         'Create invoice',
    billing_add_cancel:         'Cancel',

    // Templates modal
    billing_tpl_title:          'Invoice templates',
    billing_tpl_name_ph:        'e.g. Standard invoice',
    billing_tpl_creating:       'Creating…',
    billing_tpl_create:         'Create',
    billing_tpl_edit:           'Edit layout',
    billing_tpl_empty:          'No templates yet. Without one, invoices use the standard layout — create one to design your own.',
    billing_tpl_set_default:    'Default template',
    billing_tpl_make_default:   'Make default',
    billing_tpl_default_set:    'Default template set',
    billing_tpl_deleted:        'Template deleted',

    // Delete confirm modal
    billing_delete_title:       'Delete invoices',
    billing_delete_body:        'Delete {n} invoice(s)? This cannot be undone.',
    billing_delete_deleting:    'Deleting…',
    billing_delete_btn:         'Delete',
    billing_delete_cancel:      'Cancel',

    // Import modal
    billing_import_title:       'Import Invoices',
    billing_import_desc:        'Upload a .csv or .xlsx file. Contacts matched by email, then by name.',
    billing_import_template:    'Download CSV template',
    billing_import_choose:      'Click to choose a file',
    billing_import_importing:   'Importing…',
    billing_import_btn:         'Import',
    billing_import_cancel:      'Cancel',
    billing_import_done:        'Done',
    billing_import_another:     'Import another',
    billing_import_imported:    'imported',
    billing_import_skipped:     'skipped',
    billing_import_row:         'Row {n}',

    // InvoiceDetail / InvoicePeek header
    billing_peek_loading:       'Loading…',
    billing_peek_not_found:     'Invoice not found.',
    billing_peek_pdf:           'PDF',
    billing_peek_send:          'Send',
    billing_peek_sending:       'Sending…',
    billing_peek_remind:        'Remind',
    billing_peek_reminding:     'Sending…',
    billing_peek_credit:        'Credit',
    billing_peek_crediting:     'Crediting…',
    billing_peek_payment:       'Payment',

    // Issued / lock notice
    billing_issued_notice:      'Issued {date} — this invoice is final and cannot be edited or deleted.',
    billing_issued_credit_hint: 'Use Credit to reverse it.',

    // Sections
    billing_section_bill_to:    'Bill to',
    billing_section_inv_date:   'Invoice date',
    billing_section_due_date:   'Due date',

    // Line items table headers (detail)
    billing_li_desc:            'Description',
    billing_li_qty:             'Qty',
    billing_li_price_excl:      'Price excl.',
    billing_li_vat:             'VAT %',
    billing_li_total_excl:      'Total excl.',

    // Totals
    billing_subtotal_excl:      'Subtotal excl. VAT',
    billing_total_incl:         'Total incl. VAT',
    billing_outstanding:        'Outstanding',
    billing_vat_reversed:       'BTW verlegd (0%)',
    billing_vat_exempt:         'VAT exempt (0%)',
    billing_vat_label:          'VAT {rate}%',

    // Notes section
    billing_notes_label:        'Payment info / Notes',
    billing_notes_edit:         'Edit',
    billing_notes_ph:           'Payment terms, IBAN, remarks…',
    billing_notes_save:         'Save',
    billing_notes_cancel:       'Cancel',
    billing_notes_empty:        'No notes',

    // Payments section
    billing_payments_title:     'Payments',
    billing_pay_col_date:       'Date',
    billing_pay_col_method:     'Method',
    billing_pay_col_ref:        'Reference',
    billing_pay_col_amount:     'Amount',

    // Record payment modal
    billing_record_title:       'Record Payment',
    billing_record_amount:      'Amount (€)',
    billing_record_method:      'Method',
    billing_record_ref:         'Reference (optional)',
    billing_record_ref_ph:      'Transaction ID, cheque no…',
    billing_record_saving:      'Saving…',
    billing_record_save:        'Save',
    billing_record_cancel:      'Cancel',
    billing_record_error_amt:   'Enter an amount',
    billing_record_success:     'Payment recorded',

    // Credit note confirm
    billing_credit_confirm:     'Create a credit note reversing {number}? The original invoice stays on record.',

    // Toasts / errors
    billing_toast_created:      'Invoice created',
    billing_toast_sent:         'Invoice sent to {email}',
    billing_toast_reminded:     'Reminder sent to {email}',
    billing_toast_credit:       'Credit note created',
    billing_toast_send_fail:    'Send failed',
    billing_toast_pdf_fail:     'PDF download failed',
    billing_toast_export_fail:  'Export failed',
    billing_toast_update_fail:  'Status update failed',
    billing_toast_default_set:  'Default template set',
  },
  nl: {
    // Shared status labels
    invoice_draft:              'Concept',
    invoice_pending:            'In behandeling',
    invoice_sent:               'Verstuurd',
    invoice_received:           'Ontvangen',
    invoice_paid:               'Betaald',
    invoice_overdue:            'Verlopen',
    invoice_void:               'Ongeldig',
    invoice_not_sent:           'Niet verstuurd',

    // Page header — InvoiceList
    billing_page_title:         'Facturen',
    billing_overdue_badge:      '{n} verlopen',
    billing_btn_export:         'Exporteren',
    billing_btn_import:         'Importeren',
    billing_btn_templates:      'Sjablonen',
    billing_btn_new:            'Nieuwe factuur',

    // Search
    billing_search_ph:          'Zoek op factuurnummer of contact…',

    // Bulk bar actions
    billing_bulk_export_pdf:    'PDF exporteren',
    billing_bulk_export_csv:    'CSV exporteren',
    billing_bulk_send:          'Versturen',
    billing_bulk_delete:        'Verwijderen',

    // Table headers
    billing_col_number:         'Factuur #',
    billing_col_contact:        'Contact',
    billing_col_status:         'Status',
    billing_col_amount:         'Bedrag',
    billing_col_due_date:       'Vervaldatum',

    // Table cells
    billing_concept:            'Concept',

    // Empty states
    billing_empty_title:        'Nog geen facturen',
    billing_empty_subtitle:     'Maak je eerste factuur aan om bij te houden wat je nog tegoed hebt.',
    billing_empty_search_title: 'Geen overeenkomende facturen',
    billing_empty_search_sub:   'Probeer een ander factuurnummer of contactnaam.',
    billing_empty_cta:          'Nieuwe factuur',

    // Context menu
    billing_ctx_export_pdf:     'PDF exporteren',
    billing_ctx_export_csv:     'CSV exporteren',
    billing_ctx_send_email:     'Versturen per e-mail',
    billing_ctx_delete:         'Verwijderen',

    // Add Invoice Modal
    billing_add_title:          'Nieuwe factuur',
    billing_add_contact_label:  'Contact / Bedrijf *',
    billing_add_contact_ph:     'Zoek contact of bedrijf…',
    billing_add_items_label:    'Regelitems',
    billing_add_item_desc_ph:   'Omschrijving van dienst of product',
    billing_add_item_desc_col:  'Omschrijving',
    billing_add_item_qty_col:   'Aantal',
    billing_add_item_price_col: 'Prijs excl.',
    billing_add_item_vat_col:   'BTW %',
    billing_add_line_btn:       'Regel toevoegen',
    billing_add_subtotal:       'Subtotaal excl. BTW',
    billing_add_total_incl:     'Totaal incl. BTW',
    billing_add_vat_row:        'BTW {rate}%',
    billing_add_invoice_date:   'Factuurdatum',
    billing_add_due_date:       'Vervaldatum',
    billing_add_currency:       'Valuta',
    billing_add_status:         'Status',
    billing_add_template:       'Sjabloon',
    billing_add_template_std:   'Standaardindeling',
    billing_add_template_def:   '(standaard)',
    billing_add_notes_label:    'Betaalinformatie / Notities',
    billing_add_notes_ph:       'Bijv. IBAN NL12 BANK 0123 4567 89. Betaling binnen 30 dagen.',
    billing_add_error_contact:  'Selecteer een contact',
    billing_add_error_items:    'Voeg minimaal één regelitem toe',
    billing_add_saving:         'Opslaan…',
    billing_add_submit:         'Factuur aanmaken',
    billing_add_cancel:         'Annuleren',

    // Templates modal
    billing_tpl_title:          'Factuursjablonen',
    billing_tpl_name_ph:        'bijv. Standaardfactuur',
    billing_tpl_creating:       'Aanmaken…',
    billing_tpl_create:         'Aanmaken',
    billing_tpl_edit:           'Indeling bewerken',
    billing_tpl_empty:          'Nog geen sjablonen. Zonder sjabloon wordt de standaardindeling gebruikt — maak er een aan om je eigen ontwerp te maken.',
    billing_tpl_set_default:    'Standaardsjabloon',
    billing_tpl_make_default:   'Instellen als standaard',
    billing_tpl_default_set:    'Standaardsjabloon ingesteld',
    billing_tpl_deleted:        'Sjabloon verwijderd',

    // Delete confirm modal
    billing_delete_title:       'Facturen verwijderen',
    billing_delete_body:        '{n} factuur/facturen verwijderen? Dit kan niet ongedaan worden gemaakt.',
    billing_delete_deleting:    'Verwijderen…',
    billing_delete_btn:         'Verwijderen',
    billing_delete_cancel:      'Annuleren',

    // Import modal
    billing_import_title:       'Facturen importeren',
    billing_import_desc:        'Upload een .csv- of .xlsx-bestand. Contacten worden gekoppeld op e-mail, daarna op naam.',
    billing_import_template:    'CSV-sjabloon downloaden',
    billing_import_choose:      'Klik om een bestand te kiezen',
    billing_import_importing:   'Importeren…',
    billing_import_btn:         'Importeren',
    billing_import_cancel:      'Annuleren',
    billing_import_done:        'Klaar',
    billing_import_another:     'Nog een keer importeren',
    billing_import_imported:    'geïmporteerd',
    billing_import_skipped:     'overgeslagen',
    billing_import_row:         'Rij {n}',

    // InvoiceDetail / InvoicePeek header
    billing_peek_loading:       'Laden…',
    billing_peek_not_found:     'Factuur niet gevonden.',
    billing_peek_pdf:           'PDF',
    billing_peek_send:          'Versturen',
    billing_peek_sending:       'Versturen…',
    billing_peek_remind:        'Herinnering',
    billing_peek_reminding:     'Versturen…',
    billing_peek_credit:        'Crediteren',
    billing_peek_crediting:     'Crediteren…',
    billing_peek_payment:       'Betaling',

    // Issued / lock notice
    billing_issued_notice:      'Uitgesteld op {date} — deze factuur is definitief en kan niet worden bewerkt of verwijderd.',
    billing_issued_credit_hint: 'Gebruik Crediteren om hem terug te draaien.',

    // Sections
    billing_section_bill_to:    'Factureren aan',
    billing_section_inv_date:   'Factuurdatum',
    billing_section_due_date:   'Vervaldatum',

    // Line items table headers (detail)
    billing_li_desc:            'Omschrijving',
    billing_li_qty:             'Aantal',
    billing_li_price_excl:      'Prijs excl.',
    billing_li_vat:             'BTW %',
    billing_li_total_excl:      'Totaal excl.',

    // Totals
    billing_subtotal_excl:      'Subtotaal excl. BTW',
    billing_total_incl:         'Totaal incl. BTW',
    billing_outstanding:        'Openstaand',
    billing_vat_reversed:       'BTW verlegd (0%)',
    billing_vat_exempt:         'BTW vrijgesteld (0%)',
    billing_vat_label:          'BTW {rate}%',

    // Notes section
    billing_notes_label:        'Betaalinformatie / Notities',
    billing_notes_edit:         'Bewerken',
    billing_notes_ph:           'Betalingsvoorwaarden, IBAN, opmerkingen…',
    billing_notes_save:         'Opslaan',
    billing_notes_cancel:       'Annuleren',
    billing_notes_empty:        'Geen notities',

    // Payments section
    billing_payments_title:     'Betalingen',
    billing_pay_col_date:       'Datum',
    billing_pay_col_method:     'Methode',
    billing_pay_col_ref:        'Referentie',
    billing_pay_col_amount:     'Bedrag',

    // Record payment modal
    billing_record_title:       'Betaling vastleggen',
    billing_record_amount:      'Bedrag (€)',
    billing_record_method:      'Methode',
    billing_record_ref:         'Referentie (optioneel)',
    billing_record_ref_ph:      'Transactie-ID, chequenummer…',
    billing_record_saving:      'Opslaan…',
    billing_record_save:        'Opslaan',
    billing_record_cancel:      'Annuleren',
    billing_record_error_amt:   'Voer een bedrag in',
    billing_record_success:     'Betaling vastgelegd',

    // Credit note confirm
    billing_credit_confirm:     'Creditnota aanmaken voor {number}? De originele factuur blijft bewaard.',

    // Toasts / errors
    billing_toast_created:      'Factuur aangemaakt',
    billing_toast_sent:         'Factuur verstuurd naar {email}',
    billing_toast_reminded:     'Herinnering verstuurd naar {email}',
    billing_toast_credit:       'Creditnota aangemaakt',
    billing_toast_send_fail:    'Versturen mislukt',
    billing_toast_pdf_fail:     'PDF downloaden mislukt',
    billing_toast_export_fail:  'Exporteren mislukt',
    billing_toast_update_fail:  'Statuswijziging mislukt',
    billing_toast_default_set:  'Standaardsjabloon ingesteld',
  },
}
