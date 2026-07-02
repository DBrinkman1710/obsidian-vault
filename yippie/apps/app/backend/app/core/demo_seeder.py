"""Automatic demo data seeder — called as a BackgroundTask after /request-demo."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone


async def seed_demo_data(tenant_id: uuid.UUID, admin_user_id: uuid.UUID) -> None:
    """Insert realistic demo data for a freshly created demo tenant.

    Opens its own DB session so this can run as a FastAPI BackgroundTask after
    the request session is closed.
    """
    import logging

    from app.database import db_session, set_tenant_context
    from app.modules.billing.models import Invoice, InvoiceStatus
    from app.modules.calendar.models import CalendarEvent
    from app.modules.contacts.models import (
        Company,
        Contact,
        ContactLabel,
        contact_label_links,
    )
    from app.modules.departments.models import Department
    from app.modules.chat.models import ChatMessage, ChatSession
    from app.modules.inbox.models import (
        DraftStatus,
        DraftTicket,
        InboundMessage,
        MessageSource as InboxSource,
    )
    from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage
    from app.modules.tickets.models import (
        MessageSource,
        Ticket,
        TicketComment,
        TicketPriority,
        TicketStatus,
    )
    from app.core.models import Tenant, User

    log = logging.getLogger(__name__)
    now = datetime.now(timezone.utc)

    try:
        async with db_session() as db:
            await set_tenant_context(db, str(tenant_id))

            tenant = await db.get(Tenant, tenant_id)
            admin_user = await db.get(User, admin_user_id)
            name_raw = (tenant.name or "").strip() if tenant else ""
            company_name = name_raw or "Acme Nederland BV"
            admin_email = admin_user.email if admin_user else ""
            raw_domain = admin_email.split("@", 1)[1] if "@" in admin_email else ""
            # Don't seed demo contacts with real consumer-inbox addresses (e.g. gmail.com)
            _free_domains = {"gmail.com", "googlemail.com", "hotmail.com", "hotmail.nl",
                             "outlook.com", "outlook.nl", "live.com", "live.nl",
                             "yahoo.com", "yahoo.nl", "icloud.com", "me.com",
                             "mac.com", "msn.com", "protonmail.com", "proton.me"}
            requester_domain = raw_domain if raw_domain and raw_domain not in _free_domains else "example.nl"

            # ── Companies ────────────────────────────────────────────────────
            co_acme = Company(tenant_id=tenant_id, name=company_name, domain=requester_domain, notes="Tech scale-up, 50 fte.")
            co_boer = Company(tenant_id=tenant_id, name="De Boer Retail B.V.", domain="deboer.nl", notes="Retail chain, 12 vestigingen.")
            co_sun = Company(tenant_id=tenant_id, name="Sunflower Group", domain="sunflowergroup.eu", notes="Hospitality groep, 4 hotels.")
            db.add_all([co_acme, co_boer, co_sun])
            await db.flush()

            # ── Contact labels ───────────────────────────────────────────────
            lbl_vip = ContactLabel(tenant_id=tenant_id, name="VIP", color="#f59e0b")
            lbl_lead = ContactLabel(tenant_id=tenant_id, name="lead", color="#6366f1")
            lbl_enterprise = ContactLabel(tenant_id=tenant_id, name="enterprise", color="#8b5cf6")
            db.add_all([lbl_vip, lbl_lead, lbl_enterprise])
            await db.flush()

            # ── Contacts ─────────────────────────────────────────────────────
            c1 = Contact(tenant_id=tenant_id, full_name="Sophie van der Berg", email=f"sophie@{requester_domain}", phone="+31 6 1234 5678", company_id=co_acme.id, tags=["enterprise"])
            c2 = Contact(tenant_id=tenant_id, full_name="Lars Janssen", email=f"lars@{requester_domain}", phone="+31 6 8765 4321", company_id=co_acme.id)
            c3 = Contact(tenant_id=tenant_id, full_name="Emma de Vries", email="emma@deboer.nl", phone="+31 6 2222 3333", company_id=co_boer.id, tags=["new"])
            c4 = Contact(tenant_id=tenant_id, full_name="Tom Bakker", email="tom@deboer.nl", company_id=co_boer.id)
            c5 = Contact(tenant_id=tenant_id, full_name="Fiona Smits", email="fiona@sunflowergroup.eu", phone="+31 6 5555 6666", company_id=co_sun.id, tags=["enterprise"])
            c6 = Contact(tenant_id=tenant_id, full_name="Kees Hoekstra", email="kees@sunflowergroup.eu", company_id=co_sun.id)
            c7 = Contact(tenant_id=tenant_id, full_name="Nina Müller", email="nina@muellerservices.de", phone="+49 170 1234567")
            c8 = Contact(tenant_id=tenant_id, full_name="Marco Visser", email="marco@vissertech.nl", phone="+31 6 9999 0000", tags=["lead"])
            db.add_all([c1, c2, c3, c4, c5, c6, c7, c8])
            await db.flush()

            await db.execute(contact_label_links.insert().values(contact_id=c5.id, label_id=lbl_vip.id))
            await db.execute(contact_label_links.insert().values(contact_id=c5.id, label_id=lbl_enterprise.id))
            await db.execute(contact_label_links.insert().values(contact_id=c8.id, label_id=lbl_lead.id))
            await db.execute(contact_label_links.insert().values(contact_id=c1.id, label_id=lbl_enterprise.id))

            # ── Departments ──────────────────────────────────────────────────
            dept_support = Department(tenant_id=tenant_id, name="Support", email="support@demo.yippie.io", sla_working_days=3)
            dept_sales = Department(tenant_id=tenant_id, name="Sales", email="sales@demo.yippie.io", sla_working_days=2)
            dept_billing = Department(tenant_id=tenant_id, name="Billing", email="billing@demo.yippie.io", sla_working_days=5)
            db.add_all([dept_support, dept_sales, dept_billing])
            await db.flush()

            # ── Pipeline stages ──────────────────────────────────────────────
            stage_prospect = PipelineStage(tenant_id=tenant_id, name="Prospect", color="#64748b", display_order=1)
            stage_contacted = PipelineStage(tenant_id=tenant_id, name="Contacted", color="#6366f1", display_order=2)
            stage_demo = PipelineStage(tenant_id=tenant_id, name="Demo Scheduled", color="#f59e0b", display_order=3)
            stage_proposal = PipelineStage(tenant_id=tenant_id, name="Proposal Sent", color="#3b82f6", display_order=4)
            stage_won = PipelineStage(tenant_id=tenant_id, name="Closed Won", color="#22c55e", display_order=5)
            db.add_all([stage_prospect, stage_contacted, stage_demo, stage_proposal, stage_won])
            await db.flush()

            for contact, stage in [
                (c1, stage_contacted),
                (c3, stage_demo),
                (c5, stage_proposal),
                (c7, stage_contacted),
                (c8, stage_prospect),
            ]:
                db.add(ContactPipelineEntry(contact_id=contact.id, stage_id=stage.id, tenant_id=tenant_id))

            # ── Tickets ──────────────────────────────────────────────────────
            t1 = Ticket(
                tenant_id=tenant_id, contact_id=c1.id, department_id=dept_billing.id,
                subject="Factuur INV-2024-011 klopt niet",
                description="Klant geeft aan dat het factuurbedrag niet overeenkomt met de offerte. Bedrag is €1.250 maar offerte was €950.",
                status=TicketStatus.open, priority=TicketPriority.high, source=MessageSource.email,
                sla_due_at=now + timedelta(days=2),
            )
            t2 = Ticket(
                tenant_id=tenant_id, contact_id=c2.id, department_id=dept_support.id,
                subject="Kan niet meer inloggen op account",
                description="Lars meldt dat zijn wachtwoord reset email niet aankomt. Tijdelijk account geblokkeerd na 5 mislukte pogingen.",
                status=TicketStatus.in_progress, priority=TicketPriority.urgent, source=MessageSource.email,
                sla_due_at=now + timedelta(hours=4),
            )
            t3 = Ticket(
                tenant_id=tenant_id, contact_id=c3.id, department_id=dept_sales.id,
                subject="Interesse in Growth plan upgrade",
                description="Emma wil meer informatie over de overstap van Starter naar Growth. Huidig abonnement loopt af eind van de maand.",
                status=TicketStatus.open, priority=TicketPriority.medium, source=MessageSource.manual,
            )
            t4 = Ticket(
                tenant_id=tenant_id, contact_id=c4.id, department_id=dept_support.id,
                subject="Retourzending beschadigd product",
                description="Tom heeft product nr. 48291 ontvangen met zichtbare transportschade. Verzoek om retourlabel en vervanging.",
                status=TicketStatus.waiting, priority=TicketPriority.medium, source=MessageSource.email,
                sla_due_at=now + timedelta(days=3),
            )
            t5 = Ticket(
                tenant_id=tenant_id, contact_id=c5.id, department_id=dept_billing.id,
                subject="Maandelijks abonnement aanpassen naar jaarlijks",
                description="Fiona wil van maandelijks naar jaarlijks factureren overstappen voor het enterprise pakket. Vraagt om gecombineerde factuur.",
                status=TicketStatus.open, priority=TicketPriority.medium, source=MessageSource.email,
            )
            t6 = Ticket(
                tenant_id=tenant_id, contact_id=c6.id, department_id=dept_sales.id,
                subject="Demo inplannen voor nieuw klantenservice team",
                description="Kees wil graag een product demo voor 8 nieuwe teamleden. Voorkeur: dinsdag of donderdag ochtend.",
                status=TicketStatus.resolved, priority=TicketPriority.low, source=MessageSource.manual,
                resolved_at=now - timedelta(days=2),
            )
            t7 = Ticket(
                tenant_id=tenant_id, contact_id=c7.id, department_id=dept_support.id,
                subject="Vragen over WhatsApp integratie",
                description="Nina vraagt hoe ze haar WhatsApp Business account kan koppelen aan het platform voor inkomende berichten.",
                status=TicketStatus.in_progress, priority=TicketPriority.high, source=MessageSource.whatsapp,
                sla_due_at=now + timedelta(days=1),
            )
            t8 = Ticket(
                tenant_id=tenant_id, contact_id=c8.id, department_id=dept_sales.id,
                subject="Offerte aanvraag enterprise licentie (25 gebruikers)",
                description="Marco vraagt een offerte aan voor 25 gebruikers, inclusief API-toegang en dedicated support SLA.",
                status=TicketStatus.open, priority=TicketPriority.high, source=MessageSource.manual,
                sla_due_at=now + timedelta(days=5),
            )
            db.add_all([t1, t2, t3, t4, t5, t6, t7, t8])
            await db.flush()

            # ── Ticket comments ──────────────────────────────────────────────
            db.add(TicketComment(tenant_id=tenant_id, ticket_id=t1.id, author_id=admin_user_id, body="Factuur nagelopen — er staat inderdaad een fout in de korting. Nieuwe factuur wordt verstuurd.", is_internal=True, source=MessageSource.manual))
            db.add(TicketComment(tenant_id=tenant_id, ticket_id=t1.id, body="Goedemiddag, bedankt voor uw melding. We hebben de fout gevonden en sturen u vandaag een gecorrigeerde factuur.", is_internal=False, source=MessageSource.email))
            db.add(TicketComment(tenant_id=tenant_id, ticket_id=t2.id, author_id=admin_user_id, body=f"Account tijdelijk ontgrendeld. Reset link verstuurd naar lars@{requester_domain}.", is_internal=True, source=MessageSource.manual))
            db.add(TicketComment(tenant_id=tenant_id, ticket_id=t4.id, body="Retourlabel is verzonden per email. Verwachte vervanging: 3–5 werkdagen na ontvangst retour.", is_internal=False, source=MessageSource.email))
            db.add(TicketComment(tenant_id=tenant_id, ticket_id=t6.id, author_id=admin_user_id, body="Demo gepland op dinsdag 10:00. Invite verstuurd naar kees@sunflowergroup.eu en 7 collega's.", is_internal=False, source=MessageSource.manual))
            db.add(TicketComment(tenant_id=tenant_id, ticket_id=t7.id, author_id=admin_user_id, body="WhatsApp integratie vereist een Evolution API instance. Ik stuur Nina de setup guide.", is_internal=True, source=MessageSource.manual))

            # ── Calendar events ──────────────────────────────────────────────
            db.add(CalendarEvent(
                tenant_id=tenant_id, created_by=admin_user_id,
                title="Demo call: De Boer Retail",
                description="Product walkthrough voor Emma de Vries en het team.",
                start_at=now + timedelta(days=2),
                end_at=now + timedelta(days=2, hours=1),
                contact_id=c3.id, ticket_id=t3.id,
            ))
            db.add(CalendarEvent(
                tenant_id=tenant_id, created_by=admin_user_id,
                title="Follow-up: Sunflower Group offerte",
                description="Bel Fiona na over het jaarabonnement voorstel.",
                start_at=now + timedelta(days=5),
                end_at=now + timedelta(days=5, hours=1),
                contact_id=c5.id,
            ))
            db.add(CalendarEvent(
                tenant_id=tenant_id, created_by=admin_user_id,
                title="Kick-off meeting: Acme Nederland",
                description="Onboarding sessie met Sophie en Lars.",
                start_at=now - timedelta(days=3),
                end_at=now - timedelta(days=3) + timedelta(hours=2),
                contact_id=c1.id,
            ))
            db.add(CalendarEvent(
                tenant_id=tenant_id, created_by=admin_user_id,
                title="Enterprise offerte klaar: Marco Visser",
                description="Kosten berekening en SLA voorstel voorbereiden vóór dit gesprek.",
                start_at=now + timedelta(days=1),
                end_at=now + timedelta(days=1, hours=1),
                contact_id=c8.id, ticket_id=t8.id,
            ))

            # ── Invoices ─────────────────────────────────────────────────────
            today = now.date()
            db.add(Invoice(
                tenant_id=tenant_id, contact_id=c1.id, invoice_number="INV-2024-001",
                status=InvoiceStatus.paid,
                line_items=[{"description": "Yippie Growth (jaarabonnement)", "quantity": 1, "unit_price_cents": 125000}],
                subtotal_cents=125000, tax_cents=26250, total_cents=151250, currency="EUR",
                due_date=today - timedelta(days=60),
            ))
            db.add(Invoice(
                tenant_id=tenant_id, contact_id=c3.id, invoice_number="INV-2024-002",
                status=InvoiceStatus.sent,
                line_items=[{"description": "Yippie Starter (3 maanden)", "quantity": 1, "unit_price_cents": 85000}],
                subtotal_cents=85000, tax_cents=17850, total_cents=102850, currency="EUR",
                due_date=today + timedelta(days=14),
            ))
            db.add(Invoice(
                tenant_id=tenant_id, contact_id=c4.id, invoice_number="INV-2024-003",
                status=InvoiceStatus.overdue,
                line_items=[{"description": "Maandabonnement Support module", "quantity": 1, "unit_price_cents": 42000}],
                subtotal_cents=42000, tax_cents=8820, total_cents=50820, currency="EUR",
                due_date=today - timedelta(days=15),
            ))
            db.add(Invoice(
                tenant_id=tenant_id, contact_id=c5.id, invoice_number="INV-2024-004",
                status=InvoiceStatus.draft,
                line_items=[
                    {"description": "Yippie Enterprise (jaarabonnement)", "quantity": 1, "unit_price_cents": 180000},
                    {"description": "Dedicated support SLA", "quantity": 1, "unit_price_cents": 30000},
                ],
                subtotal_cents=210000, tax_cents=44100, total_cents=254100, currency="EUR",
                due_date=today + timedelta(days=30),
            ))

            # ── Inbox draft messages (pending AI review) ─────────────────────
            # inbound_to=None so these appear in the shared inbox regardless of
            # what INBOUND_EMAIL is configured to in the Railway env.
            msg1 = InboundMessage(
                tenant_id=tenant_id, source=InboxSource.email,
                sender="hanneke@groothandel.nl", sender_name="Hanneke Groot",
                subject="Problemen met mijn bestelling",
                raw_body=(
                    "Goedemiddag,\n\n"
                    "Ik heb vorige week een bestelling geplaatst (ordernummer #4821) maar heb nog niets ontvangen. "
                    "Wanneer kan ik levering verwachten?\n\n"
                    "Met vriendelijke groet,\nHanneke Groot"
                ),
            )
            msg2 = InboundMessage(
                tenant_id=tenant_id, source=InboxSource.email,
                sender="pieter@techbedrijf.nl", sender_name="Pieter Laan",
                subject="Vraag over API limieten enterprise plan",
                raw_body=(
                    "Hallo,\n\n"
                    "Wij willen jullie platform integreren via de REST API. Wat zijn de rate limits voor het Enterprise plan? "
                    "En is er een sandbox omgeving beschikbaar voor testing?\n\n"
                    "Groeten,\nPieter Laan\nTechBedrijf B.V."
                ),
            )
            db.add_all([msg1, msg2])
            await db.flush()

            db.add(DraftTicket(
                tenant_id=tenant_id, inbound_message_id=msg1.id, status=DraftStatus.pending,
                ai_status="done",
                ai_suggested_subject="Bestelling #4821 nog niet ontvangen",
                ai_suggested_description="Klant meldt dat bestelling #4821 van vorige week nog niet is bezorgd. Verzoek om leveringsstatus.",
                ai_suggested_priority="medium", ai_suggested_category="logistics",
            ))
            db.add(DraftTicket(
                tenant_id=tenant_id, inbound_message_id=msg2.id, status=DraftStatus.pending,
                ai_status="done",
                ai_suggested_subject="API rate limits en sandbox omgeving — Enterprise plan",
                ai_suggested_description="Potentiële enterprise klant vraagt naar API rate limits en beschikbaarheid van een sandbox testomgeving voor integratie.",
                ai_suggested_priority="high", ai_suggested_category="sales",
            ))

            # ── Live chat sessions ───────────────────────────────────────────
            chat1 = ChatSession(
                tenant_id=tenant_id,
                source="websocket",
                visitor_id="demo-visitor-1",
                visitor_name="Lisa de Graaf",
                visitor_email="lisa@example.nl",
                contact_id=c3.id,
                status="open",
                is_open=True,
                unread_count=1,
                started_at=now - timedelta(minutes=12),
            )
            chat2 = ChatSession(
                tenant_id=tenant_id,
                source="websocket",
                visitor_id="demo-visitor-2",
                visitor_name="Arjan Koopmans",
                visitor_email="arjan@example.nl",
                contact_id=c8.id,
                status="open",
                is_open=True,
                unread_count=2,
                started_at=now - timedelta(minutes=45),
            )
            chat3 = ChatSession(
                tenant_id=tenant_id,
                source="websocket",
                visitor_id="demo-visitor-3",
                visitor_name="Marieke Blom",
                status="solved",
                is_open=False,
                unread_count=0,
                started_at=now - timedelta(hours=3),
                ended_at=now - timedelta(hours=2, minutes=30),
                solved_at=now - timedelta(hours=2, minutes=30),
            )
            db.add_all([chat1, chat2, chat3])
            await db.flush()

            db.add(ChatMessage(
                tenant_id=tenant_id, session_id=chat1.id,
                sender_type="visitor", sender_id="demo-visitor-1",
                body="Hallo, ik had een vraag over mijn bestelling. Kan iemand mij helpen?",
                created_at=now - timedelta(minutes=12),
            ))
            db.add(ChatMessage(
                tenant_id=tenant_id, session_id=chat2.id,
                sender_type="visitor", sender_id="demo-visitor-2",
                body="Goedemiddag! Ik wil graag meer weten over jullie Enterprise pakket.",
                created_at=now - timedelta(minutes=45),
            ))
            db.add(ChatMessage(
                tenant_id=tenant_id, session_id=chat2.id,
                sender_type="visitor", sender_id="demo-visitor-2",
                body="Zijn er kortingen beschikbaar voor jaarlijkse abonnementen?",
                created_at=now - timedelta(minutes=44),
            ))
            db.add(ChatMessage(
                tenant_id=tenant_id, session_id=chat3.id,
                sender_type="visitor", sender_id="demo-visitor-3",
                body="Hoe kan ik mijn factuur downloaden?",
                created_at=now - timedelta(hours=3),
            ))
            db.add(ChatMessage(
                tenant_id=tenant_id, session_id=chat3.id,
                sender_type="agent", sender_id=str(admin_user_id),
                body="Hallo Marieke! U kunt uw factuur downloaden via Instellingen → Facturatie. Kan ik u verder helpen?",
                created_at=now - timedelta(hours=2, minutes=55),
            ))
            db.add(ChatMessage(
                tenant_id=tenant_id, session_id=chat3.id,
                sender_type="visitor", sender_id="demo-visitor-3",
                body="Dank je wel, dat werkt! Fijne dag.",
                created_at=now - timedelta(hours=2, minutes=50),
            ))

            await db.commit()
            log.info("Demo data seeded for tenant %s", tenant_id)

    except Exception:
        log.exception("Failed to seed demo data for tenant %s", tenant_id)
