// shipments namespace — owned by the shipments translation agent.
// Add keys as: 'prefix_key': 'English' / 'Nederlands'. Keep en and nl in lockstep.
export const shipments: { en: Record<string, string>; nl: Record<string, string> } = {
  en: {
    // CopyButton (shared within ShipmentSettingsModal)
    ship_copied:                        'Copied',
    ship_copy:                          'Copy',

    // ShipmentSettingsModal — tab labels
    ship_tab_how_it_works:              'How it works',
    ship_tab_erp_webhook:               'ERP webhook',
    ship_tab_sendcloud:                 'Sendcloud',

    // ShipmentSettingsModal — modal header & footer
    ship_settings_title:                'Track & Trace: Settings',
    ship_close:                         'Close',

    // OverviewTab
    ship_overview_intro:                'Track & Trace collects shipment data from three sources. You can use any combination.',
    ship_overview_manual_title:         'Manual entry',
    ship_overview_manual_desc:          'Agents add shipments directly in this screen: tracking number, carrier, and order reference. Useful for one-offs or when automation isn\'t set up yet.',
    ship_overview_erp_title:            'ERP / order system webhook',
    ship_overview_erp_desc:             'Your ERP or webshop (Exact, AFAS, WooCommerce, Shopify, …) posts an order event to a Yippie URL whenever a shipment is created or its status changes. Yippie matches on {order_number} and keeps the shipment in sync automatically. See the ERP webhook tab for the URL and payload format.',
    ship_overview_sendcloud_title:      'Sendcloud (carrier events)',
    ship_overview_sendcloud_desc:       'If you ship via Sendcloud, connect your account in the Sendcloud tab. Sendcloud pushes live carrier events (picked up, in transit, delivered) directly to Yippie — no polling needed. You can also manually refresh any shipment from its detail page.',

    // ErpTab
    ship_erp_intro:                     'Give your ERP or webshop this webhook URL. It should POST a JSON body whenever an order is shipped or its status changes. Yippie creates or updates the matching shipment automatically.',
    ship_erp_webhook_url_label:         'Webhook URL',
    ship_erp_secret_label:              'Shared secret (optional)',
    ship_erp_secret_configured:         'Configured',
    ship_erp_secret_not_set:            'Not set',
    ship_erp_secret_hint:               'When set, your ERP must send the secret as an {header} header. Requests without it are rejected.',
    ship_erp_rotate_btn:                'Rotate secret',
    ship_erp_generate_btn:              'Generate secret',
    ship_erp_rotate_hint:               'Rotating generates a new secret. Update your ERP immediately after.',
    ship_erp_payload_label:             'Payload format',

    // SendcloudTab (inside ShipmentSettingsModal)
    ship_sc_intro:                      'Connect your Sendcloud account to receive live carrier status updates. Find your API keys in Sendcloud under {path}.',
    ship_sc_public_key_label:           'Public key',
    ship_sc_secret_key_label:           'Secret key',
    ship_sc_public_key_ph:              'Sendcloud public key',
    ship_sc_secret_key_ph:              'Sendcloud secret key',
    ship_sc_save:                       'Save',
    ship_sc_saving:                     'Saving…',
    ship_sc_webhook_url_label:          'Sendcloud webhook URL',
    ship_sc_webhook_hint:               'Register this URL in Sendcloud under {path}. Sendcloud will POST carrier events to Yippie in real time.',
    ship_sc_saved_toast:                'Sendcloud settings saved',
    ship_sc_save_error_toast:           'Failed to save Sendcloud settings',

    // ErpTab — toast messages
    ship_erp_rotated_toast:             'Webhook secret rotated',
    ship_erp_rotate_error_toast:        'Failed to rotate secret',

    // SendcloudSettingsCard
    ship_card_title:                    'Sendcloud integration',
    ship_card_intro:                    'Connect your Sendcloud account to automatically sync shipment status updates. Find your API keys at {path}.',
    ship_card_webhook_url_label:        'Webhook URL',
    ship_card_webhook_hint:             'Register this URL in your Sendcloud panel under Settings > Webhooks.',

    // CreateShipmentModal
    ship_create_title:                  'Add shipment',
    ship_tracking_number_label:         'Tracking number',
    ship_tracking_number_ph:            'e.g. 3SYZX2000001234',
    ship_carrier_label:                 'Carrier',
    ship_carrier_other:                 'Other',
    ship_order_ref_label:               'Order reference',
    ship_order_ref_ph:                  'e.g. ORD-12345',
    ship_notes_label:                   'Notes',
    ship_notes_ph:                      'Optional notes…',
    ship_cancel:                        'Cancel',
    ship_add_btn:                       'Add shipment',
    ship_adding:                        'Adding…',
    ship_added_toast:                   'Shipment added',
    ship_add_error_toast:               'Failed to add shipment',

    // ShipmentList — page header
    ship_list_title:                    'Track & Trace',
    ship_list_count_one:                '{n} shipment',
    ship_list_count_many:               '{n} shipments',
    ship_refresh_title:                 'Refresh',
    ship_settings_title_btn:            'Settings',
    ship_new_btn:                       'New shipment',

    // ShipmentList — filters
    ship_filter_all_statuses:           'All statuses',
    ship_filter_registered:             'Registered',
    ship_filter_in_transit:             'In transit',
    ship_filter_out_for_delivery:       'Out for delivery',
    ship_filter_delivered:              'Delivered',
    ship_filter_exception:              'Exception',
    ship_filter_returned:               'Returned',
    ship_filter_cancelled:              'Cancelled',
    ship_filter_all_carriers:           'All carriers',

    // ShipmentList — table headers
    ship_col_tracking:                  'Tracking #',
    ship_col_carrier:                   'Carrier',
    ship_col_status:                    'Status',
    ship_col_order_ref:                 'Order ref',
    ship_col_eta:                       'ETA',
    ship_col_last_event:                'Last event',
    ship_col_added:                     'Added',

    // ShipmentList — empty state
    ship_empty_title:                   'No shipments yet',
    ship_empty_subtitle_agent:          'Shipments your team tracks will appear here.',
    ship_empty_subtitle_admin:          'Track your first delivery and keep customers informed automatically.',

    // ShipmentDetail — order reference label
    ship_detail_order_label:            'Order:',

    // ShipmentDetail — refresh / delete buttons
    ship_refresh_btn:                   'Refresh from Sendcloud',
    ship_delete_title:                  'Delete shipment',
    ship_delete_confirm:                'Delete this shipment?',

    // ShipmentDetail — details card
    ship_details_heading:               'Details',
    ship_detail_carrier:                'Carrier',
    ship_detail_estimated_delivery:     'Estimated delivery',
    ship_detail_order_reference:        'Order reference',
    ship_detail_added:                  'Added',
    ship_detail_updated:                'Updated',

    // ShipmentDetail — notes card
    ship_notes_heading:                 'Notes',
    ship_notes_edit:                    'Edit',
    ship_notes_save:                    'Save',
    ship_notes_saving:                  'Saving…',
    ship_notes_cancel:                  'Cancel',
    ship_notes_empty:                   'No notes',
    ship_notes_saved_toast:             'Saved',
    ship_notes_error_toast:             'Failed to save',

    // ShipmentDetail — tracking history card
    ship_history_heading:               'Tracking history',
    ship_history_empty:                 'No tracking events yet.',
    ship_history_hint:                  'Click "Refresh from Sendcloud" to fetch the latest status.',

    // ShipmentDetail — not found
    ship_not_found:                     'Shipment not found.',
    ship_back_to_list:                  'Back to list',

    // ShipmentDetail — toast messages
    ship_refreshed_toast:               'Shipment refreshed',
    ship_deleted_toast:                 'Shipment deleted',
    ship_delete_error_toast:            'Failed to delete',
  },
  nl: {
    // CopyButton
    ship_copied:                        'Gekopieerd',
    ship_copy:                          'Kopieer',

    // ShipmentSettingsModal — tab labels
    ship_tab_how_it_works:              'Hoe het werkt',
    ship_tab_erp_webhook:               'ERP-webhook',
    ship_tab_sendcloud:                 'Sendcloud',

    // ShipmentSettingsModal — modal header & footer
    ship_settings_title:                'Zendingen: Instellingen',
    ship_close:                         'Sluiten',

    // OverviewTab
    ship_overview_intro:                'Track & Trace verzamelt zendingdata uit drie bronnen. Je kunt elke combinatie gebruiken.',
    ship_overview_manual_title:         'Handmatige invoer',
    ship_overview_manual_desc:          'Medewerkers voegen zendingen rechtstreeks toe in dit scherm: trackingnummer, vervoerder en orderreferentie. Handig voor losse zendingen of wanneer automatisering nog niet is ingesteld.',
    ship_overview_erp_title:            'ERP / bestelsysteem-webhook',
    ship_overview_erp_desc:             'Jouw ERP of webshop (Exact, AFAS, WooCommerce, Shopify, …) stuurt een ordergebeurtenis naar een Yippie-URL zodra een zending wordt aangemaakt of de status verandert. Yippie koppelt op {order_number} en houdt de zending automatisch gesynchroniseerd. Zie het tabblad ERP-webhook voor de URL en het berichtformaat.',
    ship_overview_sendcloud_title:      'Sendcloud (vervoerdersgebeurtenissen)',
    ship_overview_sendcloud_desc:       'Als je via Sendcloud verzendt, koppel je je account op het tabblad Sendcloud. Sendcloud stuurt live vervoerdersgebeurtenissen (opgehaald, onderweg, bezorgd) rechtstreeks naar Yippie — geen polling nodig. Je kunt ook elke zending handmatig vernieuwen via de detailpagina.',

    // ErpTab
    ship_erp_intro:                     'Geef jouw ERP of webshop deze webhook-URL. Die moet een JSON-body POSTen wanneer een order is verzonden of de status verandert. Yippie maakt de bijbehorende zending automatisch aan of werkt die bij.',
    ship_erp_webhook_url_label:         'Webhook-URL',
    ship_erp_secret_label:              'Gedeeld geheim (optioneel)',
    ship_erp_secret_configured:         'Geconfigureerd',
    ship_erp_secret_not_set:            'Niet ingesteld',
    ship_erp_secret_hint:               'Als dit is ingesteld, moet jouw ERP het geheim meesturen als een {header}-header. Verzoeken zonder het geheim worden geweigerd.',
    ship_erp_rotate_btn:                'Geheim roteren',
    ship_erp_generate_btn:              'Geheim genereren',
    ship_erp_rotate_hint:               'Roteren genereert een nieuw geheim. Werk jouw ERP direct daarna bij.',
    ship_erp_payload_label:             'Berichtformaat',

    // SendcloudTab (inside ShipmentSettingsModal)
    ship_sc_intro:                      'Koppel je Sendcloud-account om live vervoerdersstatusupdates te ontvangen. Vind je API-sleutels in Sendcloud onder {path}.',
    ship_sc_public_key_label:           'Publieke sleutel',
    ship_sc_secret_key_label:           'Geheime sleutel',
    ship_sc_public_key_ph:              'Sendcloud publieke sleutel',
    ship_sc_secret_key_ph:              'Sendcloud geheime sleutel',
    ship_sc_save:                       'Opslaan',
    ship_sc_saving:                     'Opslaan…',
    ship_sc_webhook_url_label:          'Sendcloud webhook-URL',
    ship_sc_webhook_hint:               'Registreer deze URL in Sendcloud onder {path}. Sendcloud stuurt vervoerdersgebeurtenissen in realtime naar Yippie.',
    ship_sc_saved_toast:                'Sendcloud-instellingen opgeslagen',
    ship_sc_save_error_toast:           'Opslaan van Sendcloud-instellingen mislukt',

    // ErpTab — toast messages
    ship_erp_rotated_toast:             'Webhook-geheim geroteerd',
    ship_erp_rotate_error_toast:        'Roteren van geheim mislukt',

    // SendcloudSettingsCard
    ship_card_title:                    'Sendcloud-integratie',
    ship_card_intro:                    'Koppel je Sendcloud-account om zendingstatusupdates automatisch te synchroniseren. Vind je API-sleutels bij {path}.',
    ship_card_webhook_url_label:        'Webhook-URL',
    ship_card_webhook_hint:             'Registreer deze URL in je Sendcloud-paneel onder Instellingen > Webhooks.',

    // CreateShipmentModal
    ship_create_title:                  'Zending toevoegen',
    ship_tracking_number_label:         'Trackingnummer',
    ship_tracking_number_ph:            'bijv. 3SYZX2000001234',
    ship_carrier_label:                 'Vervoerder',
    ship_carrier_other:                 'Overig',
    ship_order_ref_label:               'Orderreferentie',
    ship_order_ref_ph:                  'bijv. ORD-12345',
    ship_notes_label:                   'Notities',
    ship_notes_ph:                      'Optionele notities…',
    ship_cancel:                        'Annuleren',
    ship_add_btn:                       'Zending toevoegen',
    ship_adding:                        'Toevoegen…',
    ship_added_toast:                   'Zending toegevoegd',
    ship_add_error_toast:               'Toevoegen van zending mislukt',

    // ShipmentList — page header
    ship_list_title:                    'Track & Trace',
    ship_list_count_one:                '{n} zending',
    ship_list_count_many:               '{n} zendingen',
    ship_refresh_title:                 'Vernieuwen',
    ship_settings_title_btn:            'Instellingen',
    ship_new_btn:                       'Nieuwe zending',

    // ShipmentList — filters
    ship_filter_all_statuses:           'Alle statussen',
    ship_filter_registered:             'Geregistreerd',
    ship_filter_in_transit:             'Onderweg',
    ship_filter_out_for_delivery:       'Uit voor bezorging',
    ship_filter_delivered:              'Bezorgd',
    ship_filter_exception:              'Uitzondering',
    ship_filter_returned:               'Retour',
    ship_filter_cancelled:              'Geannuleerd',
    ship_filter_all_carriers:           'Alle vervoerders',

    // ShipmentList — table headers
    ship_col_tracking:                  'Tracking #',
    ship_col_carrier:                   'Vervoerder',
    ship_col_status:                    'Status',
    ship_col_order_ref:                 'Orderref.',
    ship_col_eta:                       'Verwachte bezorging',
    ship_col_last_event:                'Laatste gebeurtenis',
    ship_col_added:                     'Toegevoegd',

    // ShipmentList — empty state
    ship_empty_title:                   'Nog geen zendingen',
    ship_empty_subtitle_agent:          'Zendingen die je team volgt, verschijnen hier.',
    ship_empty_subtitle_admin:          'Volg je eerste bezorging en houd klanten automatisch op de hoogte.',

    // ShipmentDetail — order reference label
    ship_detail_order_label:            'Order:',

    // ShipmentDetail — refresh / delete buttons
    ship_refresh_btn:                   'Vernieuwen via Sendcloud',
    ship_delete_title:                  'Zending verwijderen',
    ship_delete_confirm:                'Deze zending verwijderen?',

    // ShipmentDetail — details card
    ship_details_heading:               'Details',
    ship_detail_carrier:                'Vervoerder',
    ship_detail_estimated_delivery:     'Verwachte bezorging',
    ship_detail_order_reference:        'Orderreferentie',
    ship_detail_added:                  'Toegevoegd',
    ship_detail_updated:                'Bijgewerkt',

    // ShipmentDetail — notes card
    ship_notes_heading:                 'Notities',
    ship_notes_edit:                    'Bewerken',
    ship_notes_save:                    'Opslaan',
    ship_notes_saving:                  'Opslaan…',
    ship_notes_cancel:                  'Annuleren',
    ship_notes_empty:                   'Geen notities',
    ship_notes_saved_toast:             'Opgeslagen',
    ship_notes_error_toast:             'Opslaan mislukt',

    // ShipmentDetail — tracking history card
    ship_history_heading:               'Bezorggeschiedenis',
    ship_history_empty:                 'Nog geen bezorgevents.',
    ship_history_hint:                  'Klik op "Vernieuwen via Sendcloud" om de laatste status op te halen.',

    // ShipmentDetail — not found
    ship_not_found:                     'Zending niet gevonden.',
    ship_back_to_list:                  'Terug naar lijst',

    // ShipmentDetail — toast messages
    ship_refreshed_toast:               'Zending vernieuwd',
    ship_deleted_toast:                 'Zending verwijderd',
    ship_delete_error_toast:            'Verwijderen mislukt',
  },
}
