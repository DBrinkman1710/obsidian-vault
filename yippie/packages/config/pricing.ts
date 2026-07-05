// DO NOT EDIT — generated from packages/config/modules.json by packages/config/sync.mjs.
// Run `pnpm sync:config` after editing modules.json.
export const PLAN_LIMITS = {
  founder:    { users: 10, contacts: null, aiScans: 500, priceMonthly: 9, priceAnnual: 97, moduleDiscount: 0.5 },
  starter:    { users: 3, contacts: null, aiScans: 2000, priceMonthly: 19, priceAnnual: 205, moduleDiscount: 0 },
  growth:     { users: 10, contacts: null, aiScans: 5000, priceMonthly: 39, priceAnnual: 421, moduleDiscount: 0 },
  pro:        { users: 25, contacts: null, aiScans: 10000, priceMonthly: 69, priceAnnual: 745, moduleDiscount: 0 },
  enterprise: { users: null, contacts: null, aiScans: null, priceMonthly: null, priceAnnual: null, moduleDiscount: 0 },
} as const;

export const MODULE_PRICES = {
  tickets: 9,
  calendar: 7,
  pipeline: 7,
  billing: 7,
  chat: 9,
  departments: 7,
  marketing: 9,
  tracking: 9,
  sales: 20,
  saas: 20,
  ai: 15,
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
