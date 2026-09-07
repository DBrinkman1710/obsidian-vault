"""Bilingual email copy for all Yippie transactional emails.

Each entry has an 'en' and 'nl' variant.  The English text is verbatim from
the original code; Dutch is a warm, professional translation using informal
"je"/"jij" — the voice is Diederik's, not a template.

Usage:
    from app.core.email_i18n import EMAILS, pick

    t = pick(lang)               # returns the translation dict for the email
    t["invite"]["subject"].format(tenant_name="Acme")
"""
from __future__ import annotations

_VALID_LANGS = {"en", "nl"}


def pick(lang: str) -> str:
    """Normalise a language code; fall back to 'nl' for anything unknown."""
    return lang if lang in _VALID_LANGS else "nl"


# ---------------------------------------------------------------------------
# Copy bank
# ---------------------------------------------------------------------------
# Each top-level key matches the email function name (without "send_").
# Plain bodies use {placeholders}; prerendered HTML bodies are built in the
# email functions themselves (they need f-strings with runtime values), so
# only localised *string fragments* are stored here.
# ---------------------------------------------------------------------------

EMAILS: dict[str, dict[str, dict[str, str]]] = {

    # ── Invite email (send_invite_email) ─────────────────────────────────────
    "invite": {
        "en": {
            "subject": "Set your password for your {tenant_name} account on Yippie",
            "greeting": "Hi {full_name},",
            "line1": "You've been invited to {tenant_name} on Yippie.",
            "line2": "Set your password here (the link is valid for 7 days):",
            "footer": "Team Yippie",
            "ignore": "If you weren't expecting this email, you can safely ignore it.",
        },
        "nl": {
            "subject": "Stel je wachtwoord in voor je {tenant_name}-account op Yippie",
            "greeting": "Hoi {full_name},",
            "line1": "Je bent uitgenodigd voor {tenant_name} op Yippie.",
            "line2": "Stel je wachtwoord in via de link hieronder (de link is 7 dagen geldig):",
            "footer": "Team Yippie",
            "ignore": "Als je deze uitnodiging niet verwachtte, kun je deze e-mail veilig negeren.",
        },
    },

    # ── Demo ready email (send_demo_ready_email) ──────────────────────────────
    "demo_ready": {
        "en": {
            "subject": "Your Yippie workspace is ready",
            "greeting": "Hi {first_name},",
            "line1": "Thank you for requesting a Yippie demo. Really appreciate you taking the time.",
            "line2": "Your workspace is ready. Click the link below to get started (no password needed):",
            "line2_html": "Your workspace is ready. Click the button below to get started. No password needed.",
            "btn_label": "Open your Yippie workspace",
            "line3": "If you have any questions while exploring, just reply. I read everything.",
            "sign_off": "Looking forward to hearing what you think,",
            "signature": "Diederik",
            "title": "Founder, Yippie",
        },
        "nl": {
            "subject": "Je Yippie-werkruimte is klaar",
            "greeting": "Hoi {first_name},",
            "line1": "Bedankt dat je een Yippie-demo hebt aangevraagd. Echt fijn dat je de tijd neemt.",
            "line2": "Je werkruimte staat klaar. Klik op de link hieronder om te starten (geen wachtwoord nodig):",
            "line2_html": "Je werkruimte staat klaar. Klik op de knop hieronder om direct te beginnen. Geen wachtwoord nodig.",
            "btn_label": "Open mijn Yippie-werkruimte",
            "line3": "Heb je vragen terwijl je rondkijkt? Stuur gewoon een reply. Ik lees alles zelf.",
            "sign_off": "Benieuwd wat je ervan vindt,",
            "signature": "Diederik",
            "title": "Oprichter, Yippie",
        },
    },

    # ── Verification / entry-link email (send_verification_email) ────────────
    "verification": {
        "en": {
            "subject": "Your Yippie workspace is ready. First 30 days free",
            "greeting": "Hi {first_name},",
            "line1": "Your Yippie workspace is ready. Click the link below to step right in:",
            "line2": "Your first 30 days are free, no payment details needed, cancel any time.",
            "line3_template": "The link is valid for 48 hours. {after_line}",
            "after_auto": "You'll choose your password once you're in.",
            "after_normal": "After that, just log in with your email and the password you chose at signup.",
            "ignore": "If you didn't sign up for Yippie, you can safely ignore this email.",
            "signature": "Diederik",
            "title": "Founder, Yippie",
            # HTML fragments
            "html_intro": "Your Yippie workspace is ready. One click and you're in. Your first 30 days are free, no payment details needed.",
            "btn_label": "Enter my workspace",
        },
        "nl": {
            "subject": "Je Yippie-werkruimte is klaar. Eerste 30 dagen gratis",
            "greeting": "Hoi {first_name},",
            "line1": "Je Yippie-werkruimte is klaar. Klik op de link hieronder om direct in te stappen:",
            "line2": "De eerste 30 dagen zijn gratis, geen betaalgegevens nodig, op elk moment op te zeggen.",
            "line3_template": "De link is 48 uur geldig. {after_line}",
            "after_auto": "Je kiest je wachtwoord zodra je ingelogd bent.",
            "after_normal": "Daarna log je gewoon in met je e-mail en het wachtwoord dat je bij de aanmelding hebt gekozen.",
            "ignore": "Als je je niet hebt aangemeld bij Yippie, kun je deze e-mail veilig negeren.",
            "signature": "Diederik",
            "title": "Oprichter, Yippie",
            # HTML fragments
            "html_intro": "Je Yippie-werkruimte is klaar. Eén klik en je bent binnen. De eerste 30 dagen zijn gratis, geen betaalgegevens nodig.",
            "btn_label": "Ga naar mijn werkruimte",
        },
    },

    # ── Welcome-to-inbox email (send_welcome_to_inbox) ────────────────────────
    "welcome_inbox": {
        "en": {
            "subject": "Welcome to Yippie 👋",
            "greeting": "Hi {tenant_name},",
            "intro": (
                "Welcome to Yippie! This is your inbox. Every email your customers send to your\n"
                "support address lands here, and Yippie drafts a ticket for each one automatically."
            ),
            "getting_started_header": "Getting started:",
            "getting_started": (
                "  - Inbox: review the tickets Yippie drafts from incoming mail. Approve, edit or reject.\n"
                "  - Contacts: your customers, with history and AI briefings\n"
                "  - Tickets: everything your team is working on, with deadlines"
            ),
            "setup_header": "Set up your email:",
            "setup": (
                "  - Your team's shared support address is already connected. New mail appears in Inbox.\n"
                "  - Want your own address too? Go to Settings -> Profile and set a personal email\n"
                "    address. Mail sent to it lands in your Personal inbox, and you can send from it\n"
                "    when replying or composing"
            ),
            "admin_header": "As an admin you can also:",
            "admin": (
                "  - Invite your team from Settings -> Team. Every teammate gets their own login.\n"
                "  - Manage departments and follow up times from Settings -> Departments"
            ),
            "closing": "Questions? Just reply. A real person reads it.",
            "sign_off": "Take back the time that matters,",
            "footer": "Team Yippie",
        },
        "nl": {
            "subject": "Welkom bij Yippie 👋",
            "greeting": "Hoi {tenant_name},",
            "intro": (
                "Welkom bij Yippie! Dit is je inbox. Elke e-mail die je klanten sturen naar je\n"
                "supportadres komt hier binnen, en Yippie maakt er automatisch een ticket van."
            ),
            "getting_started_header": "Snel aan de slag:",
            "getting_started": (
                "  - Inbox: bekijk de tickets die Yippie aanmaakt van binnenkomende e-mail. Goedkeuren, bewerken of afwijzen.\n"
                "  - Contacten: al je klanten, met geschiedenis en AI-samenvattingen\n"
                "  - Tickets: alles waar je team mee bezig is, met deadlines"
            ),
            "setup_header": "Je e-mail instellen:",
            "setup": (
                "  - Het gedeelde supportadres van je team is al gekoppeld. Nieuwe mail verschijnt in de Inbox.\n"
                "  - Wil je ook een eigen adres? Ga naar Instellingen -> Profiel en voeg een persoonlijk e-mailadres toe.\n"
                "    Mail die daarnaar wordt gestuurd komt in je Persoonlijke inbox, en je kunt er ook mee versturen\n"
                "    wanneer je antwoordt of een nieuw bericht maakt"
            ),
            "admin_header": "Als beheerder kun je ook:",
            "admin": (
                "  - Teamleden uitnodigen via Instellingen -> Team. Elk teamlid krijgt een eigen login.\n"
                "  - Afdelingen en opvolgingstijden beheren via Instellingen -> Afdelingen"
            ),
            "closing": "Vragen? Stuur gewoon een reply. Een echt persoon leest het.",
            "sign_off": "Terug naar wat er echt toe doet,",
            "footer": "Team Yippie",
        },
    },

    # ── Password reset email (in app/auth/router.py) ──────────────────────────
    "password_reset": {
        "en": {
            "subject": "Reset your Yippie password",
            "greeting": "Hi {full_name},",
            "line1": "Reset your password here:",
            "line2": "This link is valid for 1 hour. If you didn't request this, you can ignore it.",
        },
        "nl": {
            "subject": "Reset je Yippie-wachtwoord",
            "greeting": "Hoi {full_name},",
            "line1": "Reset je wachtwoord via deze link:",
            "line2": "De link is 1 uur geldig. Als je dit niet hebt aangevraagd, kun je deze e-mail negeren.",
        },
    },
}
