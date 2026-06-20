// Canonical module IDs — must match ALL_MODULES in apps/app/backend/app/config.py
export const MODULE_IDS = [
  "inbox", "contacts", "tickets", "calendar",
  "pipeline", "chat", "ai", "emailtracking",
  "activity", "billing", "departments",
] as const;

export type ModuleId = typeof MODULE_IDS[number];
