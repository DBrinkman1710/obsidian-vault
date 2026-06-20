// Single source of truth for plan pricing — mirrors apps/app/backend/app/core/plans.py
// Update both files together when prices change.
// All plans have unlimited contacts. Plans differ by users and AI scans/month.

export const PLAN_LIMITS = {
  founder:    { users: 2,    contacts: null, aiScans: 500,    priceMonthly: 9,    priceAnnual: 97   },
  starter:    { users: 5,    contacts: null, aiScans: 2_000,  priceMonthly: 19,   priceAnnual: 205  },
  growth:     { users: 10,   contacts: null, aiScans: 10_000, priceMonthly: 49,   priceAnnual: 529  },
  enterprise: { users: null, contacts: null, aiScans: null,   priceMonthly: null, priceAnnual: null },
} as const;

export const MODULE_PRICES = {
  tickets:       15,
  ai:            19,
  calendar:      12,
  kanban:        12,
  emailtracking:  9,
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
