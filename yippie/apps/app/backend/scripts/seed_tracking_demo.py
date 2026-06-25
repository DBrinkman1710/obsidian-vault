"""
Seed realistic tracking demo orders into Yippie via the ERP webhook.

Fetches your real contacts, assigns each a test order in a different status,
then fires the webhook so the Orders card in TicketDetail/ContactDetail lights up.

Run:  python3 seed_tracking_demo.py
      (prompts for base URL + password)

Safe to re-run — orders upsert on order_number, so no duplicates.
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta

_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE

BASE = "https://sandbox.getyippie.com/api/v1"
EMAIL = "diederik1710@gmail.com"

# Demo orders covering every status + a realistic progression
DEMO_ORDERS = [
    {
        "status": "registered",
        "carrier": "postnl",
        "description": "Pakket aangemeld bij PostNL.",
        "order_suffix": "REG",
        "tracking_suffix": None,
    },
    {
        "status": "in_transit",
        "carrier": "postnl",
        "description": "Pakket onderweg — verwacht morgen bezorgd.",
        "order_suffix": "TRN",
        "tracking_suffix": "3SYZMA",
    },
    {
        "status": "out_for_delivery",
        "carrier": "dhl",
        "description": "Pakket is op weg naar het afleveradres.",
        "order_suffix": "OFD",
        "tracking_suffix": "JD0034",
    },
    {
        "status": "delivered",
        "carrier": "postnl",
        "description": "Pakket afgeleverd bij de deur.",
        "order_suffix": "DEL",
        "tracking_suffix": "3SYZMA",
    },
    {
        "status": "exception",
        "carrier": "dpd",
        "description": "Bezorging mislukt — niemand thuis. Tweede poging morgen.",
        "order_suffix": "EXC",
        "tracking_suffix": "DPD123",
    },
    {
        "status": "returned",
        "carrier": "dhl",
        "description": "Pakket retour ontvangen op het depot.",
        "order_suffix": "RET",
        "tracking_suffix": "JD0099",
    },
]


def request(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} on {method} {path}: {e.read().decode()[:200]}")
        return {}


def webhook(slug: str, payload: dict) -> int:
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(
        f"{BASE.rsplit('/api/v1', 1)[0]}/api/v1/webhooks/shipments/orders/{slug}",
        data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def main():
    print("=== Yippie Tracking demo seed ===\n")

    password = os.environ.get("YIPPIE_PASSWORD") or sys.argv[1] if len(sys.argv) > 1 else os.environ.get("YIPPIE_PASSWORD")
    if not password:
        print(f"Usage: YIPPIE_PASSWORD=xxx python3 seed_tracking_demo.py")
        sys.exit(1)

    print("\n→ Logging in...")
    auth = request("POST", "/auth/login", {"email": EMAIL, "password": password})
    token = auth.get("access_token")
    if not token:
        print("Login failed:", auth)
        sys.exit(1)
    print("  ✓ Logged in")

    print("→ Fetching tenant info...")
    team = request("GET", "/team", token=token)
    slug = team.get("slug", "")
    if not slug:
        # fallback: try tenant config
        config = request("GET", "/tenant/config", token=token)
        slug = config.get("slug", "")
    if not slug:
        print("  Could not determine tenant slug. Response:", team)
        sys.exit(1)
    print(f"  ✓ Slug: {slug}")

    print("→ Fetching contacts...")
    contacts_resp = request("GET", "/contacts?limit=10", token=token)
    contacts = contacts_resp.get("items", [])
    if not contacts:
        print("  No contacts found — create a few contacts in sandbox first, then re-run.")
        sys.exit(1)
    print(f"  ✓ Found {len(contacts)} contacts")

    today = datetime.now(timezone.utc)

    print("\n→ Firing ERP webhook for each demo order...\n")
    for i, order_def in enumerate(DEMO_ORDERS):
        contact = contacts[i % len(contacts)]
        contact_email = contact.get("email") or ""
        contact_name = contact.get("full_name", "?")
        order_number = f"ORD-DEMO-{order_def['order_suffix']}-001"
        tracking_number = None
        if order_def["tracking_suffix"]:
            tracking_number = f"{order_def['tracking_suffix']}{100 + i:04d}NL"
        eta = (today + timedelta(days=1)).strftime("%Y-%m-%dT10:00:00Z") if order_def["status"] in ("registered", "in_transit", "out_for_delivery") else None

        payload = {
            "order_number": order_number,
            "status": order_def["status"],
            "carrier": order_def["carrier"],
            "description": order_def["description"],
        }
        if contact_email:
            payload["contact_email"] = contact_email
        if tracking_number:
            payload["tracking_number"] = tracking_number
        if eta:
            payload["estimated_delivery"] = eta

        status_code = webhook(slug, payload)
        link = f"→ {contact_name}" if contact_email else "(no email — not linked)"
        print(f"  [{status_code}] {order_number:30s}  {order_def['status']:20s}  {link}")

    print("\n→ Verifying — listing shipments...\n")
    shipments = request("GET", "/shipments?limit=20", token=token)
    items = shipments.get("items", [])
    if not items:
        print("  ✗ No shipments found — check that the Tracking module is enabled for your tenant.")
        sys.exit(1)

    print(f"  {'Order':30s}  {'Status':20s}  {'Tracking':20s}  {'Carrier'}")
    print(f"  {'-'*30}  {'-'*20}  {'-'*20}  {'-'*10}")
    for s in items:
        print(f"  {(s.get('order_reference') or '—'):30s}  {s.get('status','?'):20s}  {(s.get('tracking_number') or '—'):20s}  {s.get('carrier','?')}")

    print(f"\n✓ Done. {len(items)} order(s) in Yippie.")
    print("  Open a contact or ticket in sandbox — the Orders card should show their order(s).")


if __name__ == "__main__":
    main()
