// Single source of truth for plan pricing — mirrors apps/app/backend/app/core/plans.py
// Update both files together when prices change.
// All plans have unlimited contacts. Plans differ by users and AI scans/month.
// App frontend: apps/app/frontend/src/lib/pricing.ts — keep both in sync when prices change.

export const PLAN_LIMITS = {
  founder:    { users: 10,   contacts: null, aiScans: 500,    priceMonthly: 9,    priceAnnual: 97   },
  starter:    { users: 3,    contacts: null, aiScans: 2_000,  priceMonthly: 19,   priceAnnual: 205  },
  growth:     { users: 5,    contacts: null, aiScans: 5_000,  priceMonthly: 39,   priceAnnual: 421  },
  pro:        { users: 10,   contacts: null, aiScans: 10_000, priceMonthly: 69,   priceAnnual: 745  },
  enterprise: { users: null, contacts: null, aiScans: null,   priceMonthly: null, priceAnnual: null },
} as const;

export const MODULE_PRICES = {
  tickets:     9,
  ai:          15,
  calendar:    7,
  kanban:      7,
  chat:        9,
  marketing:   9,
  departments: 7,
  billing:     7,
  tracking:    9,
  sales:       20,
  saas:        20,
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
