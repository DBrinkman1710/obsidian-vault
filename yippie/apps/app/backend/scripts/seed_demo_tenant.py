#!/usr/bin/env python3
"""Seed a realistic demo tenant on sandbox (or any Yippie environment) via the public API.

Creates the tenant "Bright Horizons BV" with all 15 modules enabled, then
impersonates its admin and populates every module with believable Dutch data so
the marketing screenshots look like a real, busy workspace.

Usage:
    export SANDBOX_BASE_URL=https://sandbox.getyippie.com   # optional, this is the default
    export ADMIN_EMAIL=you@example.com                      # a superadmin on that environment
    export ADMIN_PASSWORD=...                               # that superadmin's password
    python3 seed_demo_tenant.py

The script is best-effort: a failing endpoint prints its status + body and the
run continues. If the tenant slug already exists it stops and asks you to delete
it first (or re-run after deletion).
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

try:
    import httpx  # type: ignore
    _CLIENT = "httpx"
except ImportError:  # pragma: no cover - fallback path
    import requests  # type: ignore
    _CLIENT = "requests"


BASE_URL = os.environ.get("SANDBOX_BASE_URL", "https://sandbox.getyippie.com").rstrip("/")
API = f"{BASE_URL}/api/v1"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

TENANT_SLUG = "bright-horizons"
TENANT_NAME = "Bright Horizons BV"
DEMO_ADMIN_EMAIL = "admin@bright-horizons.demo"
DEMO_ADMIN_PASSWORD = "BrightDemo2026!"

ENABLED_MODULES = [
    "inbox", "contacts", "tickets", "calendar", "pipeline", "booking",
    "activity", "billing", "chat", "departments", "marketing", "tracking",
    "sales", "saas",
]

# Today is the anchor for relative dates (the marketing site goes live 2026-06).
NOW = datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Tiny HTTP layer (works with either httpx or requests)
# --------------------------------------------------------------------------- #

class Api:
    def __init__(self, base: str):
        self.base = base
        self.token: str | None = None
        if _CLIENT == "httpx":
            self._client = httpx.Client(timeout=60.0)
        else:  # pragma: no cover
            self._client = requests.Session()

    def _headers(self, extra: dict | None = None) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if extra:
            h.update(extra)
        return h

    def request(self, method: str, path: str, *, json=None, auth=True, params=None):
        url = path if path.startswith("http") else f"{self.base}{path}"
        headers = self._headers()
        if not auth:
            headers.pop("Authorization", None)
        if _CLIENT == "httpx":
            return self._client.request(method, url, json=json, headers=headers, params=params)
        return self._client.request(method, url, json=json, headers=headers, params=params)

    def post(self, path, json=None, *, auth=True, ok=(200, 201), label=None):
        return self._call("POST", path, json=json, auth=auth, ok=ok, label=label)

    def put(self, path, json=None, *, auth=True, ok=(200, 201, 204), label=None):
        return self._call("PUT", path, json=json, auth=auth, ok=ok, label=label)

    def patch(self, path, json=None, *, auth=True, ok=(200, 201), label=None):
        return self._call("PATCH", path, json=json, auth=auth, ok=ok, label=label)

    def get(self, path, *, params=None, auth=True, ok=(200,), label=None):
        return self._call("GET", path, auth=auth, ok=ok, params=params, label=label)

    def _call(self, method, path, *, json=None, auth=True, ok=(200, 201), params=None, label=None):
        resp = self.request(method, path, json=json, auth=auth, params=params)
        tag = label or f"{method} {path}"
        if resp.status_code not in ok:
            body = resp.text[:500]
            print(f"  ! {tag} -> {resp.status_code}: {body}")
            return None
        try:
            return resp.json() if resp.text else {}
        except ValueError:
            return {}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def day(offset_days: int, hour: int = 10, minute: int = 0) -> datetime:
    base = NOW + timedelta(days=offset_days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


# --------------------------------------------------------------------------- #
# Seed steps
# --------------------------------------------------------------------------- #

def login_superadmin(api: Api) -> bool:
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("ERROR: set ADMIN_EMAIL and ADMIN_PASSWORD env vars (a superadmin on this environment).")
        return False
    data = api.post(
        "/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        auth=False,
        label="auth/login (superadmin)",
    )
    if not data or "access_token" not in data:
        print("ERROR: superadmin login failed.")
        return False
    api.token = data["access_token"]
    print(f"Logged in as superadmin {ADMIN_EMAIL}")
    return True


def create_tenant(api: Api) -> str | None:
    body = {
        "name": TENANT_NAME,
        "slug": TENANT_SLUG,
        "admin_email": DEMO_ADMIN_EMAIL,
        "admin_password": DEMO_ADMIN_PASSWORD,
        "admin_full_name": "Sophie van den Berg",
        "is_demo": True,
        "enabled_modules": ENABLED_MODULES,
    }
    resp = api.request("POST", "/admin/tenants", json=body)
    if resp.status_code == 409:
        # Tenant exists — look it up so we can still impersonate and patch.
        print(f"  Tenant slug '{TENANT_SLUG}' already exists — looking it up to patch…")
        tenants = api.get("/admin/tenants", ok=(200,), label="list tenants") or []
        for t in tenants:
            if t.get("slug") == TENANT_SLUG:
                print(f"  Found existing tenant ({t['id']})")
                return t["id"], True  # (id, already_existed)
        print(f"  ! Could not find existing tenant '{TENANT_SLUG}' — aborting.")
        return None, False
    if resp.status_code not in (200, 201):
        print(f"  ! POST /admin/tenants -> {resp.status_code}: {resp.text[:500]}")
        return None, False
    tenant = resp.json()
    tid = tenant["id"]
    print(f"Created tenant {TENANT_NAME} ({tid})")
    return tid, False


def impersonate(api: Api, tenant_id: str) -> bool:
    data = api.post(f"/admin/tenants/{tenant_id}/impersonate", json={}, label="impersonate")
    if not data or "access_token" not in data:
        print("ERROR: impersonation failed; cannot seed module data.")
        return False
    api.token = data["access_token"]
    print(f"Impersonating tenant admin ({data.get('impersonated_user_email')})")
    return True


def seed_companies(api: Api) -> dict[str, str]:
    print("\nSeeding companies...")
    out: dict[str, str] = {}
    # Schema is {name, domain, notes} — the brief's "website" maps to `domain`.
    companies = [
        {"name": "Bright Horizons BV", "domain": "brighthorizons.nl"},
        {"name": "TechVault Solutions", "domain": "techvault.io"},
        {"name": "Nova Agency", "domain": "nova-agency.nl"},
    ]
    for c in companies:
        res = api.post("/contacts/companies", json=c, label=f"company {c['name']}")
        if res:
            out[c["name"]] = res["id"]
            print(f"  + company {c['name']}")
    return out


def seed_contacts(api: Api, companies: dict[str, str]) -> list[dict]:
    print("\nSeeding contacts...")
    bh = companies.get("Bright Horizons BV")
    tv = companies.get("TechVault Solutions")
    nv = companies.get("Nova Agency")
    specs = [
        {"full_name": "Daan Jansen", "email": "daan.jansen@brighthorizons.nl", "phone": "+31 6 12345678",
         "company_id": bh, "notes": "Hoofdcontact voor het support-contract. Belt liever dan mailt.",
         "tags": ["vip", "support"]},
        {"full_name": "Emma de Vries", "email": "emma.devries@brighthorizons.nl", "phone": "+31 6 23456789",
         "company_id": bh, "notes": "Verantwoordelijk voor facturatie.", "tags": ["billing"]},
        {"full_name": "Lucas Bakker", "email": "lucas.bakker@techvault.io", "phone": "+31 6 34567890",
         "company_id": tv, "notes": "Technisch contactpersoon, integratievragen.", "tags": ["technical"]},
        {"full_name": "Sophie Visser", "email": "sophie.visser@techvault.io", "phone": "+31 6 45678901",
         "company_id": tv, "notes": "Beslisser bij upgrade-trajecten.", "tags": ["vip", "decision-maker"]},
        {"full_name": "Sem Smit", "email": "sem.smit@nova-agency.nl", "phone": "+31 6 56789012",
         "company_id": nv, "notes": "Wil graag een demo van de marketing-module.", "tags": ["lead"]},
        {"full_name": "Julia Meijer", "email": "julia.meijer@nova-agency.nl", "phone": "+31 6 67890123",
         "company_id": nv, "notes": "Reageert snel via WhatsApp.", "tags": ["lead", "whatsapp"]},
        {"full_name": "Noah van Dijk", "email": "noah.vandijk@gmail.com", "phone": "+31 6 78901234",
         "company_id": None, "notes": "Particuliere klant, retourvraag.", "tags": ["consumer"]},
        {"full_name": "Mila Mulder", "email": "mila.mulder@outlook.com", "phone": "+31 6 89012345",
         "company_id": None, "notes": None, "tags": ["consumer"]},
        {"full_name": "Liam de Boer", "email": "liam.deboer@brighthorizons.nl", "phone": None,
         "company_id": bh, "notes": "Nieuwe medewerker, nog geen telefoonnummer.", "tags": ["support"]},
        {"full_name": "Tess Hendriks", "email": "tess.hendriks@techvault.io", "phone": "+31 6 90123456",
         "company_id": tv, "notes": None, "tags": ["technical"]},
        {"full_name": "Finn van Leeuwen", "email": "finn.vanleeuwen@nova-agency.nl", "phone": "+31 6 11223344",
         "company_id": nv, "notes": "Geïnteresseerd in jaarcontract.", "tags": ["lead"]},
        {"full_name": "Saar Dekker", "email": "saar.dekker@gmail.com", "phone": "+31 6 22334455",
         "company_id": None, "notes": "Vraag over levertijd.", "tags": ["consumer"]},
        {"full_name": "Bram Vermeulen", "email": "bram.vermeulen@brighthorizons.nl", "phone": "+31 6 33445566",
         "company_id": bh, "notes": "Tweede support-contact.", "tags": ["support"]},
        {"full_name": "Lotte Schouten", "email": "lotte.schouten@outlook.com", "phone": "+31 6 44556677",
         "company_id": None, "notes": None, "tags": ["consumer"]},
    ]
    contacts: list[dict] = []
    for s in specs:
        res = api.post("/contacts", json=s, label=f"contact {s['full_name']}")
        if res:
            contacts.append(res)
            print(f"  + contact {s['full_name']}")
    return contacts


def seed_tickets(api: Api, contacts: list[dict]) -> None:
    print("\nSeeding tickets...")
    cids = [c["id"] for c in contacts]

    def cid(i: int):
        return cids[i] if i < len(cids) else None

    specs = [
        # 3 open high
        {"subject": "Inloggen lukt niet na wachtwoordreset", "priority": "high", "source": "email",
         "contact_id": cid(0), "description": "Klant kan niet inloggen nadat het wachtwoord opnieuw is ingesteld."},
        {"subject": "Betaling mislukt bij afrekenen", "priority": "high", "source": "whatsapp",
         "contact_id": cid(6), "description": "iDEAL-betaling wordt geweigerd, klant wil bestelling afronden."},
        {"subject": "Integratie met boekhoudpakket werkt niet", "priority": "high", "source": "email",
         "contact_id": cid(2), "description": "API-koppeling geeft een 401 sinds de laatste update."},
        # 3 medium pending
        {"subject": "Factuur klopt niet — verkeerd BTW-tarief", "priority": "medium", "source": "email",
         "contact_id": cid(1), "description": "Op factuur INV-0007 staat 21% i.p.v. 9% BTW."},
        {"subject": "Vraag over levertijd bestelling #4821", "priority": "medium", "source": "whatsapp",
         "contact_id": cid(11), "description": "Wanneer wordt het pakket bezorgd?"},
        {"subject": "Demo inplannen voor marketing-module", "priority": "medium", "source": "manual",
         "contact_id": cid(4), "description": "Lead wil een persoonlijke demo van de campagne-tools."},
        # 3 resolved low
        {"subject": "Adreswijziging doorgeven", "priority": "low", "source": "email",
         "contact_id": cid(7), "description": "Klant is verhuisd en wil het factuuradres aanpassen."},
        {"subject": "Hoe exporteer ik mijn contacten?", "priority": "low", "source": "manual",
         "contact_id": cid(9), "description": "Klant zoekt de CSV-export knop."},
        {"subject": "Nieuwsbrief uitschrijven", "priority": "low", "source": "email",
         "contact_id": cid(13), "description": "Verzoek om uitschrijving van de maandelijkse nieuwsbrief."},
    ]
    created = []
    for s in specs:
        res = api.post("/tickets", json=s, label=f"ticket {s['subject'][:30]}")
        if res:
            created.append(res)
            print(f"  + ticket {s['subject'][:40]}")

    # Resolve the last three (the low-priority ones).
    for tk in created[-3:]:
        r = api.patch(f"/tickets/{tk['id']}/status", json={"status": "resolved"},
                      label=f"resolve ticket {tk['id']}")
        if r is not None:
            print(f"  ~ resolved ticket {tk['subject'][:40]}")


def seed_calendar(api: Api, contacts: list[dict]) -> None:
    print("\nSeeding calendar events...")
    cids = [c["id"] for c in contacts]

    def cid(i):
        return cids[i] if i < len(cids) else None

    events = [
        {"title": "Onboarding-call Bright Horizons", "description": "Kick-off met het support-team.",
         "start_at": iso(day(-5, 11)), "end_at": iso(day(-5, 12)), "all_day": False,
         "contact_id": cid(0), "calendar_type": "shared", "notify_contact": False},
        {"title": "Demo marketing-module — Nova Agency", "description": "Persoonlijke demo voor lead.",
         "start_at": iso(day(2, 14)), "end_at": iso(day(2, 15)), "all_day": False,
         "contact_id": cid(4), "calendar_type": "shared", "notify_contact": False},
        {"title": "Kwartaalreview TechVault", "description": "Bespreken upgrade-traject.",
         "start_at": iso(day(6, 10)), "end_at": iso(day(6, 11)), "all_day": False,
         "contact_id": cid(3), "calendar_type": "shared", "notify_contact": False},
        {"title": "Teamoverleg support", "description": "Wekelijkse stand-up.",
         "start_at": iso(day(1, 9, 30)), "end_at": iso(day(1, 10)), "all_day": False,
         "contact_id": None, "calendar_type": "shared", "notify_contact": False},
    ]
    for e in events:
        res = api.post("/calendar/events", json=e, label=f"event {e['title'][:30]}")
        if res:
            print(f"  + event {e['title'][:40]}")


def seed_pipeline(api: Api, contacts: list[dict]) -> None:
    print("\nSeeding pipeline stages + assignments...")
    stages_spec = [
        {"name": "Prospect", "color": "#94a3b8"},
        {"name": "Qualified", "color": "#5BA4F5"},
        {"name": "Demo Booked", "color": "#8b5cf6"},
        {"name": "Proposal Sent", "color": "#f59e0b"},
        {"name": "Closed Won", "color": "#22c55e"},
    ]
    stage_ids: list[str] = []
    for s in stages_spec:
        res = api.post("/pipeline/stages", json=s, label=f"stage {s['name']}")
        if res:
            stage_ids.append(res["id"])
            print(f"  + stage {s['name']}")

    if not stage_ids:
        return

    cids = [c["id"] for c in contacts]
    # 2 contacts per stage.
    pairs = list(zip(cids, [stage_ids[i // 2] for i in range(min(len(cids), len(stage_ids) * 2))]))
    for contact_id, stage_id in pairs:
        r = api.put(f"/pipeline/contacts/{contact_id}/stage", json={"stage_id": stage_id},
                    label=f"move contact {contact_id[:8]}")
        if r is not None:
            print(f"  ~ contact {contact_id[:8]} -> stage")


def seed_departments(api: Api) -> None:
    print("\nSeeding departments...")
    depts = [
        {"name": "Support", "email": "support@bright-horizons.demo", "sla_working_days": 2},
        {"name": "Sales", "email": "sales@bright-horizons.demo", "sla_working_days": 3},
        {"name": "Operations", "email": "operations@bright-horizons.demo", "sla_working_days": 5},
    ]
    for d in depts:
        res = api.post("/departments", json=d, label=f"department {d['name']}")
        if res:
            print(f"  + department {d['name']}")


def seed_invoices(api: Api, contacts: list[dict]) -> None:
    print("\nSeeding invoices...")
    cids = [c["id"] for c in contacts]
    if not cids:
        return

    def cid(i):
        return cids[i % len(cids)]

    specs = [
        {"contact_id": cid(0), "description": "Maandelijks support-abonnement juni",
         "line_items": [{"description": "Support Plus — juni 2026", "quantity": 1, "unit_price_cents": 9900}],
         "tax_cents": 2079, "currency": "EUR", "due_date": str(day(-20).date()), "status": "paid"},
        {"contact_id": cid(1), "description": "Implementatie & onboarding",
         "line_items": [{"description": "Onboarding-uren", "quantity": 8, "unit_price_cents": 8500}],
         "tax_cents": 14280, "currency": "EUR", "due_date": str(day(10).date()), "status": "pending"},
        {"contact_id": cid(2), "description": "API-integratie maatwerk",
         "line_items": [
             {"description": "Ontwikkeluren", "quantity": 12, "unit_price_cents": 9500},
             {"description": "Projectmanagement", "quantity": 2, "unit_price_cents": 7500},
         ],
         "tax_cents": 27090, "currency": "EUR", "due_date": str(day(14).date()), "status": "pending"},
        {"contact_id": cid(3), "description": "Jaarlicentie Growth-plan",
         "line_items": [{"description": "Growth jaarabonnement", "quantity": 1, "unit_price_cents": 46800}],
         "tax_cents": 9828, "currency": "EUR", "due_date": str(day(-7).date()), "status": "overdue"},
        {"contact_id": cid(4), "description": "Concept — extra gebruikersseats",
         "line_items": [{"description": "Extra seats (5)", "quantity": 5, "unit_price_cents": 1900}],
         "tax_cents": 1995, "currency": "EUR", "due_date": str(day(21).date()), "status": "draft"},
    ]
    for s in specs:
        res = api.post("/billing/invoices", json=s, label=f"invoice {s.get('status')}")
        if res:
            print(f"  + invoice ({s['status']}) {res.get('invoice_number', '')}")


def seed_subscriptions(api: Api, contacts: list[dict]) -> None:
    print("\nSeeding subscriptions...")
    cids = [c["id"] for c in contacts]
    if not cids:
        return
    specs = [
        {"contact_id": cids[0], "plan_name": "Starter", "billing_cycle": "monthly",
         "amount_cents": 1900, "currency": "EUR"},
        {"contact_id": cids[2 % len(cids)], "plan_name": "Growth", "billing_cycle": "monthly",
         "amount_cents": 3900, "currency": "EUR"},
        {"contact_id": cids[3 % len(cids)], "plan_name": "Pro", "billing_cycle": "annual",
         "amount_cents": 6900, "currency": "EUR"},
    ]
    for s in specs:
        res = api.post("/billing/subscriptions", json=s, label=f"subscription {s['plan_name']}")
        if res:
            print(f"  + subscription {s['plan_name']} ({s['billing_cycle']})")


def seed_marketing(api: Api) -> None:
    print("\nSeeding marketing campaigns...")
    template_html = (
        "<h1>Hallo {{name}}</h1>"
        "<p>Bedankt dat je klant bent bij Bright Horizons. "
        "Deze maand hebben we een aantal mooie nieuwe functies gelanceerd "
        "die je werk makkelijker maken.</p>"
        "<p>Met vriendelijke groet,<br/>Het Bright Horizons-team</p>"
    )

    c1 = api.post("/marketing/campaigns",
                  json={"name": "June Product Update", "subject": "Nieuw deze maand bij Bright Horizons",
                        "dispatch_channel": "email"},
                  label="campaign June Product Update")
    if c1:
        print("  + campaign June Product Update")
        api.post(f"/marketing/campaigns/{c1['id']}/templates",
                 json={"templates": [{"variant": None, "raw_html": template_html}]},
                 ok=(200, 201), label="template (c1)")
        # Launch so the campaign shows a non-draft (sending/completed) status.
        # Demo contacts use @*.demo addresses, so any real send simply fails
        # per-recipient (logged, non-fatal) — nothing reaches a real inbox.
        launched = api.post(f"/marketing/campaigns/{c1['id']}/launch", json={"enable_ab": False},
                            ok=(200, 201), label="launch campaign June Product Update")
        if launched:
            print(f"  ~ launched campaign June Product Update -> {launched.get('status')}")

    c2 = api.post("/marketing/campaigns",
                  json={"name": "Summer Promo 2026", "subject": "Zomeractie — 20% korting op jaarplannen",
                        "dispatch_channel": "email"},
                  label="campaign Summer Promo 2026")
    if c2:
        print("  + campaign Summer Promo 2026 (draft)")
        api.post(f"/marketing/campaigns/{c2['id']}/templates",
                 json={"templates": [{"variant": None,
                                      "raw_html": "<h1>Zomeractie!</h1><p>Hallo {{name}}, profiteer nu van 20% korting.</p>"}]},
                 ok=(200, 201), label="template (c2)")


def seed_shipments(api: Api, contacts: list[dict]) -> None:
    print("\nSeeding shipments...")
    cids = [c["id"] for c in contacts]

    def cid(i):
        return cids[i % len(cids)] if cids else None

    specs = [
        {"tracking_number": "3SABCD1234567", "carrier": "postnl", "contact_id": cid(6),
         "order_reference": "ORD-4821", "notes": "Retourzending in behandeling."},
        {"tracking_number": "JD0000412345678", "carrier": "dhl", "contact_id": cid(7),
         "order_reference": "ORD-4822", "notes": None},
        {"tracking_number": "1Z999AA10123456784", "carrier": "ups", "contact_id": cid(11),
         "order_reference": "ORD-4830", "notes": "Spoedlevering."},
        {"tracking_number": "794612345678", "carrier": "fedex", "contact_id": cid(13),
         "order_reference": "ORD-4835", "notes": None},
    ]
    for s in specs:
        res = api.post("/shipments", json=s, label=f"shipment {s['carrier']}")
        if res:
            print(f"  + shipment {s['carrier']} {s['order_reference']}")


def seed_booking(api: Api) -> None:
    print("\nConfiguring booking availability...")
    # The booking module exposes only settings + token endpoints (no slot CRUD).
    # Set a Mon-Fri 09:00-17:00 working window with 30-min slots where supported.
    body = {
        "availability": {
            "monday": [{"start": "09:00", "end": "17:00"}],
            "tuesday": [{"start": "09:00", "end": "17:00"}],
            "wednesday": [{"start": "09:00", "end": "17:00"}],
            "thursday": [{"start": "09:00", "end": "17:00"}],
            "friday": [{"start": "09:00", "end": "17:00"}],
        },
        "slot_minutes": 30,
        "meeting_duration_minutes": 30,
    }
    # Best-effort: the settings schema varies, so try PATCH and accept failure quietly.
    res = api.patch("/booking/settings", json=body, ok=(200, 201), label="booking settings")
    if res:
        print("  ~ booking availability set (Mon-Fri 09:00-17:00, 30-min slots)")
    else:
        print("  (booking settings schema differs — skipped; calendar UI still shows booking)")


# --------------------------------------------------------------------------- #
# Extra seed steps (tour, tracking events)
# --------------------------------------------------------------------------- #

def dismiss_tour(api: Api) -> None:
    """Mark the welcome tour completed AND dismiss the setup checklist so neither
    overlays the screenshots."""
    res = api.patch(
        "/auth/me",
        json={"tour_completed": True, "setup_checklist_dismissed": True},
        ok=(200, 201),
        label="dismiss tour + setup checklist",
    )
    if res:
        print("  ~ welcome tour + setup checklist dismissed")


def seed_inbox(api: Api, tenant_id: str, superadmin_token: str) -> None:
    """Inject realistic inbox draft items via the superadmin-only seed endpoint.

    The current `api` is impersonating the tenant admin, but the seed-inbox
    endpoint requires a superadmin token — so we swap the token for the call and
    restore the impersonation token afterwards."""
    print("\nSeeding inbox items...")
    imp_token = api.token
    api.token = superadmin_token
    try:
        res = api.post(
            f"/admin/tenants/{tenant_id}/seed-inbox",
            json={},
            ok=(200, 201),
            label="seed inbox",
        )
    finally:
        api.token = imp_token
    if res:
        print(f"  + {res.get('created', 0)} inbox items created")


def cleanup_default_pipeline_stages(api: Api) -> None:
    """Delete the 5 empty DEFAULT pipeline stages so only the custom (populated)
    stages remain visible. Only deletes default-named stages that have 0 contacts."""
    print("\nCleaning up default pipeline stages...")
    default_names = {"Questionnaire Lead", "Lead", "Demo", "Call Planned", "Live"}

    stages = api.get("/pipeline/stages", ok=(200,), label="list pipeline stages") or []
    if isinstance(stages, dict):
        stages = stages.get("items", stages.get("stages", []))
    if not stages:
        print("  (no stages returned — skipped)")
        return

    # Cross-check contact counts via the board (each column is {stage, contacts}).
    board = api.get("/pipeline/board", ok=(200,), label="pipeline board") or []
    counts: dict[str, int] = {}
    if isinstance(board, list):
        for col in board:
            stage = col.get("stage", {}) if isinstance(col, dict) else {}
            sid = stage.get("id")
            contacts = col.get("contacts") or []
            if sid is not None:
                counts[str(sid)] = len(contacts)

    for s in stages:
        sid = str(s.get("id"))
        name = s.get("name", "")
        # Prefer the board's live count; fall back to the stage's own contact_count.
        count = counts.get(sid, s.get("contact_count", 0))
        if name in default_names and count == 0:
            r = api.request("DELETE", f"/pipeline/stages/{sid}")
            if r.status_code in (200, 204):
                print(f"  - deleted empty default stage '{name}'")
            else:
                print(f"  ! delete stage '{name}' -> {r.status_code}: {r.text[:200]}")


def seed_tracking_events(api: Api, contacts: list[dict]) -> None:
    """Inject saas + commerce events via the public /track endpoint so
    the Sales and SaaS dashboards show real-looking data."""

    # Get this tenant's tracking token
    tok_data = api.get("/saas/token", ok=(200,), label="saas/token")
    if not tok_data or "tracking_token" not in tok_data:
        print("  ! Could not get tracking token — skipping event injection")
        return
    token = tok_data["tracking_token"]
    print(f"\nSeeding tracking events (token {token[:8]}…)")

    # Use the public ingest endpoint (no auth header needed)
    public_api = Api(f"{BASE_URL}/api/v1/public")
    public_api.token = None  # no auth

    emails = [c.get("email") for c in contacts if c.get("email")]

    # ------------------------------------------------------------------ #
    # SaaS domain events — powers the SaaS Product Analytics dashboard
    # ------------------------------------------------------------------ #
    saas_batches = [
        # Onboarding completions
        *[{
            "token": token,
            "contact_email": emails[i % len(emails)],
            "anonymous_id": f"anon-{i:04d}",
            "event_domain": "saas",
            "events": [
                {"event_type": "onboarding_step", "properties": {"step": "connect_inbox",   "status": "completed"}},
                {"event_type": "onboarding_step", "properties": {"step": "invite_teammate",  "status": "completed"}},
                {"event_type": "onboarding_step", "properties": {"step": "create_ticket",    "status": "completed" if i % 3 != 0 else "skipped"}},
                {"event_type": "onboarding_step", "properties": {"step": "setup_pipeline",   "status": "completed" if i % 4 != 0 else "skipped"}},
            ],
        } for i in range(8)],
        # Feature usage
        *[{
            "token": token,
            "contact_email": emails[i % len(emails)],
            "anonymous_id": f"anon-feat-{i:04d}",
            "event_domain": "saas",
            "events": [
                {"event_type": "feature_used", "properties": {"feature": feat}},
            ],
        } for i, feat in enumerate([
            "inbox_ai_scan", "inbox_ai_scan", "inbox_ai_scan",
            "ticket_bulk_action", "ticket_bulk_action",
            "pipeline_drag_drop", "pipeline_drag_drop",
            "contact_import", "calendar_booking", "marketing_campaign",
            "billing_invoice", "live_chat", "shipment_tracking",
        ])],
        # Errors
        *[{
            "token": token,
            "contact_email": emails[i % len(emails)],
            "anonymous_id": f"anon-err-{i:04d}",
            "event_domain": "saas",
            "events": [
                {"event_type": "error_encountered", "properties": {"code": code, "feature": feat}},
            ],
        } for i, (code, feat) in enumerate([
            ("QUOTA_EXCEEDED",  "ai_scan"),
            ("QUOTA_EXCEEDED",  "ai_scan"),
            ("SMTP_AUTH_FAIL",  "email_send"),
            ("WEBHOOK_TIMEOUT", "inbox_webhook"),
            ("RATE_LIMITED",    "api"),
        ])],
    ]

    ok = 0
    for batch in saas_batches:
        r = public_api.post("/track", json=batch, auth=False, ok=(200, 201), label="saas track")
        if r:
            ok += r.get("ingested", 0)
    print(f"  + {ok} saas events ingested")

    # ------------------------------------------------------------------ #
    # Commerce domain events — powers the Sales Tracking dashboard
    # ------------------------------------------------------------------ #
    pages = [
        "/products/support-plan-starter",
        "/products/support-plan-growth",
        "/products/support-plan-pro",
        "/pricing",
        "/pricing",
        "/pricing",
        "/checkout",
        "/checkout",
        "/blog/reduce-support-costs",
        "/",
    ]
    commerce_batches = [
        # Pageviews
        *[{
            "token": token,
            "contact_email": emails[i % len(emails)],
            "anonymous_id": f"shop-{i:04d}",
            "event_domain": "commerce",
            "events": [
                {"event_type": "pageview", "properties": {"url": pages[i % len(pages)], "referrer": "https://google.com"}},
            ],
        } for i in range(24)],
        # Add-to-cart
        *[{
            "token": token,
            "contact_email": emails[i % len(emails)],
            "anonymous_id": f"shop-{i:04d}",
            "event_domain": "commerce",
            "events": [
                {"event_type": "add_to_cart", "properties": {"product": "Support Plan Growth", "price_cents": 3900}},
            ],
        } for i in range(6)],
        # Purchases
        *[{
            "token": token,
            "contact_email": emails[i % len(emails)],
            "anonymous_id": f"shop-{i:04d}",
            "event_domain": "commerce",
            "events": [
                {"event_type": "purchase", "properties": {"product": prod, "revenue_cents": rev, "order_id": f"ORD-{5000+i}"}},
            ],
        } for i, (prod, rev) in enumerate([
            ("Support Plan Starter", 1900),
            ("Support Plan Growth",  3900),
            ("Support Plan Growth",  3900),
            ("Support Plan Pro",     6900),
        ])],
    ]

    ok2 = 0
    for batch in commerce_batches:
        r = public_api.post("/track", json=batch, auth=False, ok=(200, 201), label="commerce track")
        if r:
            ok2 += r.get("ingested", 0)
    print(f"  + {ok2} commerce events ingested")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main() -> int:
    print(f"Seeding demo tenant on {BASE_URL}\n" + "=" * 50)
    api = Api(API)

    if not login_superadmin(api):
        return 1

    result = create_tenant(api)
    if result is None or result[0] is None:
        return 1
    tenant_id, already_existed = result

    # Keep the superadmin token: a few endpoints (seed-inbox) are superadmin-only
    # and must not use the impersonation token.
    superadmin_token = api.token

    if not impersonate(api, tenant_id):
        return 1

    if already_existed:
        # Tenant exists — only run the new steps we hadn't done before.
        print("\nTenant already seeded — patching with missing data only…")
        dismiss_tour(api)
        cleanup_default_pipeline_stages(api)
        seed_inbox(api, tenant_id, superadmin_token)
        # Fetch existing contacts to use for tracking events
        contacts_data = api.get("/contacts", ok=(200,), label="list contacts") or {}
        contacts = contacts_data.get("items", []) if isinstance(contacts_data, dict) else contacts_data
        seed_tracking_events(api, contacts)
    else:
        companies = seed_companies(api)
        contacts = seed_contacts(api, companies)
        seed_departments(api)
        seed_tickets(api, contacts)
        seed_calendar(api, contacts)
        seed_pipeline(api, contacts)
        cleanup_default_pipeline_stages(api)
        seed_invoices(api, contacts)
        seed_subscriptions(api, contacts)
        seed_marketing(api)
        seed_shipments(api, contacts)
        seed_booking(api)
        dismiss_tour(api)
        seed_inbox(api, tenant_id, superadmin_token)
        seed_tracking_events(api, contacts)

    print("\n" + "=" * 27)
    print("=== DEMO TENANT READY ===")
    print(f"URL: {BASE_URL}")
    print(f"Email: {DEMO_ADMIN_EMAIL}")
    print(f"Password: {DEMO_ADMIN_PASSWORD}")
    print(f"Tenant slug: {TENANT_SLUG}")
    print("=" * 27)
    return 0


if __name__ == "__main__":
    sys.exit(main())
