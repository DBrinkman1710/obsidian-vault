export type Lang = 'en' | 'nl'

export const translations = {
  en: {
    // Sidebar modules
    inbox:       'Inbox',
    contacts:    'Contacts',
    tickets:     'Tickets',
    calendar:    'Calendar',
    kanban:      'Kanban',
    activity:    'Activity',
    billing:     'Billing',
    livechat:    'Live Chat',
    marketing:   'Marketing',
    departments: 'Departments',
    // Sidebar settings nav
    profile:  'Profile',
    team:     'Team',
    settings: 'Settings',
    sign_out: 'Sign out',
    // Ticket status
    status_open:        'Open',
    status_in_progress: 'In progress',
    status_waiting:     'Waiting for customer',
    status_resolved:    'Resolved',
    status_closed:      'Closed',
    // Ticket priority
    priority_low:    'Low',
    priority_medium: 'Medium',
    priority_high:   'High',
    priority_urgent: 'Urgent',
    // Invoice status
    invoice_pending:  'Pending',
    invoice_received: 'Received',
    invoice_not_sent: 'Not Sent',
    invoice_paid:     'Paid',
    invoice_overdue:  'Overdue',
  },
  nl: {
    // Sidebar modules
    inbox:       'Postvak',
    contacts:    'Contacten',
    tickets:     'Tickets',
    calendar:    'Agenda',
    kanban:      'Kanban',
    activity:    'Activiteit',
    billing:     'Facturatie',
    livechat:    'Live chat',
    marketing:   'Marketing',
    departments: 'Afdelingen',
    // Sidebar settings nav
    profile:  'Profiel',
    team:     'Team',
    settings: 'Instellingen',
    sign_out: 'Uitloggen',
    // Ticket status
    status_open:        'Open',
    status_in_progress: 'In behandeling',
    status_waiting:     'Wacht op klant',
    status_resolved:    'Opgelost',
    status_closed:      'Gesloten',
    // Ticket priority
    priority_low:    'Laag',
    priority_medium: 'Gemiddeld',
    priority_high:   'Hoog',
    priority_urgent: 'Urgent',
    // Invoice status
    invoice_pending:  'In behandeling',
    invoice_received: 'Ontvangen',
    invoice_not_sent: 'Niet verzonden',
    invoice_paid:     'Betaald',
    invoice_overdue:  'Verlopen',
  },
} as const

export type TKey = keyof typeof translations.en
