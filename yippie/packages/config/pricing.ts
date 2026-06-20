// Single source of truth for plan pricing — mirrors apps/app/backend/app/core/plans.py
// Update both files together when prices change.

export const PLAN_LIMITS = {
  founder: { users: 2,    contacts: 1_000,  priceMonthly: 9,   priceAnnual: 97   },
  starter: { users: 5,    contacts: 5_000,  priceMonthly: 29,  priceAnnual: 313  },
  growth:  { users: 15,   contacts: 25_000, priceMonthly: 69,  priceAnnual: 745  },
  pro:     { users: null, contacts: null,   priceMonthly: 99,  priceAnnual: 1069 },
} as const;

export const MODULE_PRICES = {
  tickets:       15,
  ai:            19,
  calendar:      12,
  kanban:        12,
  emailtracking:  9,
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
