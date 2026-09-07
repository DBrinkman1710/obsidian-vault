// Aggregates every per-module translation namespace.
// Each module file is owned by one translation agent so they never conflict.
// To add a new namespace: create ./<name>.ts exporting { en, nl } and list it here.
import { shell } from './shell'
import { inbox } from './inbox'
import { contacts } from './contacts'
import { tickets } from './tickets'
import { marketing } from './marketing'
import { admin } from './admin'
import { adminSettings } from './adminsettings'
import { shipments } from './shipments'
import { templates } from './templates'
import { flows } from './flows'
import { booking } from './booking'
import { chat } from './chat'
import { activity } from './activity'
import { sales } from './sales'
import { saas } from './saas'
import { pipeline } from './pipeline'
import { billing } from './billing'
import { contracts } from './contracts'
import { calendar } from './calendar'
import { publicPages } from './publicpages'
import { tour } from './tour'
import { shared } from './shared'

export const extraNamespaces: { en: Record<string, string>; nl: Record<string, string> }[] = [
  shell, inbox, contacts, tickets, marketing, admin, adminSettings, shipments,
  templates, flows, booking, chat, activity, sales, saas, pipeline, billing,
  contracts, calendar, publicPages, tour, shared,
]
