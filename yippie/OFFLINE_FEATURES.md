# Offline Features

Features that have been built but temporarily taken offline. Re-enable by reverting the noted changes.

---

## Contact Labels

**Taken offline:** 2026-06-24

**What it was:** Labels could be created and assigned to contacts. The Contacts page showed a label filter bar at the top (chips for each label) and a Labels column in the contact table.

**Why parked:** Redundant for current use — not actively used and adds visual noise.

**To re-enable:**
1. `ColumnPicker.tsx` — add `{ key: 'labels', label: 'Labels', visible: true, order: 3 }` back to `DEFAULT_CONTACT_COLUMNS` (renumber subsequent items to order 4–7).
2. `ContactsPage.tsx` (`ContactsTab`) — restore `LabelChip`/`fetchLabels`/`ContactLabel` imports, re-add `labelFilter` state, restore `fetchLabels` query, add `label_id: labelFilter` to the contacts query params, restore the label filter chips block, restore `labels: ContactLabel[]` on the `Contact` interface, restore the labels column render in the `visibleColumns` loop.
3. Backend is untouched — label CRUD endpoints and data are fully intact.
