// Copy for the installation-company use case clickthrough.
// EN lives on `/`, NL lives on `/nl` — same component, different content prop.

export type EmailOverlay = {
  /** "out" = Yippie sends it automatically; "in" = customer replies. */
  direction: "out" | "in";
  from: string;
  subject: string;
  body: string;
};

export type UseCaseStep = {
  /** Kanban stage / short tag shown on the step tab. */
  tag: string;
  /** Small callout pill floated on the browser bar (top-right). */
  callout: string;
  title: string;
  desc: string;
  /** Screenshot in /public/usecase + its intrinsic size. */
  img: string;
  w: number;
  h: number;
  /** Fake browser-bar URL. Defaults to app.getyippie.com. */
  url?: string;
  /** Optional mini email window floated over the screenshot. */
  email?: EmailOverlay;
};

export type UseCaseContent = {
  eyebrow: string;
  heading: string;
  sub: string;
  prev: string;
  next: string;
  sentLabel: string;
  replyLabel: string;
  steps: UseCaseStep[];
};

export const USECASE_EN: UseCaseContent = {
  eyebrow: "For installers & field service",
  heading: "From first click to loyal customer",
  sub: "One flow, fully automatic. Here is how an installation company runs on Yippie.",
  prev: "Back",
  next: "Next",
  sentLabel: "Sent automatically",
  replyLabel: "Customer reply",
  steps: [
    {
      tag: "Request",
      callout: "Website form submitted",
      title: "The request comes in",
      desc: "A visitor fills in the form on your own website. The second they hit send, Yippie captures it, no copy-paste and no lost lead.",
      img: "/usecase/step1_form.png",
      w: 2000,
      h: 1051,
      url: "mylastbike.com",
    },
    {
      tag: "Interest",
      callout: "New contact → Interested",
      title: "Interest captured",
      desc: "Yippie creates the contact and drops them straight into the pipeline under Interested. Nothing slips through the cracks.",
      img: "/usecase/step2_kanban.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "Follow up",
      callout: "Two action buttons",
      title: "One email, two choices",
      desc: "Your rep sends a follow-up with two buttons: book an appointment, or remind me in a month. Built right in Yippie's email designer.",
      img: "/usecase/step3_email.png",
      w: 1440,
      h: 600,
    },
    {
      tag: "Booking",
      callout: "Customer picks a slot",
      title: "The customer books themselves",
      desc: "They pick a time that suits them. Your planning team sets the availability, and contractors slot themselves onto the bookings.",
      img: "/usecase/step4_booking.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "Booked",
      callout: "Automatic stage move",
      title: "Booked, confirmed, reminded",
      desc: "The contact moves to Booked on its own, and a confirmation with prep details plus reminders a week and a day before all go out automatically.",
      img: "/usecase/step5_booked.png",
      w: 1440,
      h: 900,
      email: {
        direction: "out",
        from: "My Last Bike",
        subject: "Your appointment is confirmed ✓",
        body: "Hi Jan, you're booked for Tue 12 Aug at 10:00. Here's how to prepare before we arrive…",
      },
    },
    {
      tag: "After sales",
      callout: "Job done → After sales",
      title: "After the job is done",
      desc: "Installation complete. The contact moves to After sales, ready for a review request, an upsell, or a follow-up flow.",
      img: "/usecase/step6_aftersales.png",
      w: 1440,
      h: 900,
      email: {
        direction: "in",
        from: "Jan de Vries",
        subject: "Re: How did everything go?",
        body: "All done and riding perfectly, thanks for the great service! Happy to leave a review.",
      },
    },
  ],
};

// ── Story 2: support follow-up (WhatsApp → resolved) ──────────────────────
export const USECASE2_EN: UseCaseContent = {
  eyebrow: "For installers & field service",
  heading: "One problem, zero dropped balls",
  sub: "A customer hits a snag after the job. Watch Yippie carry it from WhatsApp to resolved, without the chaos.",
  prev: "Back",
  next: "Next",
  sentLabel: "Sent automatically",
  replyLabel: "Customer reply",
  steps: [
    {
      tag: "WhatsApp",
      callout: "WhatsApp → Yip drafts a reply",
      title: "The problem comes in on WhatsApp",
      desc: "Jan messages that something's off after his fitting. Yip reads it and drafts a reply for your agent to review, no blank page to stare at.",
      img: "/usecase2/s2_1_whatsapp.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "Ticket",
      callout: "Drafted → Operations",
      title: "It becomes a ticket, automatically",
      desc: "Not a quick fix? One click turns the chat into a ticket. Yip writes the description, sets the priority, and routes it to Operations with an SLA.",
      img: "/usecase2/s2_2_ticket.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "In service",
      callout: "Automatic stage move",
      title: "The customer stays in the loop",
      desc: "The contact moves to In service and an update goes out with the steps taken and a realistic estimate, before anyone has to chase for one.",
      img: "/usecase2/s2_3_kanban.png",
      w: 1440,
      h: 900,
      email: {
        direction: "out",
        from: "My Last Bike",
        subject: "Update on your repair",
        body: "Hi Jan, we've logged your creak with our Operations team. Expected resolution: within 4 working days. We'll be in touch to schedule a visit.",
      },
    },
    {
      tag: "Booking",
      callout: "Questions + self-booking",
      title: "Operations lines up the visit",
      desc: "Two quick diagnostic questions and a booking link. Jan answers and picks a slot that suits him, no phone tag, no back-and-forth.",
      img: "/usecase2/s2_4_booking.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "Dispatch",
      callout: "Contractor self-claims",
      title: "A contractor claims the job",
      desc: "The available contractor assigns the booking to himself and automatically receives the full ticket, the problem details, and Jan's answers.",
      img: "/usecase2/s2_5_claim.png",
      w: 1440,
      h: 900,
      email: {
        direction: "out",
        from: "Yippie → Contractor",
        subject: "You claimed: creaking noise (Jan de Vries)",
        body: "Ticket, address, the two answers and the full history, everything the contractor needs, sent the moment they claim it.",
      },
    },
    {
      tag: "Resolved",
      callout: "Fixed → auto review request",
      title: "Fixed, confirmed, reviewed",
      desc: "Jan confirms it's solved with one button and the contact returns to After sales. Yippie automatically asks him to rate the service, closing the loop.",
      img: "/usecase2/s2_6_resolved.png",
      w: 1440,
      h: 900,
      email: {
        direction: "in",
        from: "Jan de Vries",
        subject: "Re: Is it fixed?",
        body: "Perfect, the creak is completely gone, thanks for the quick help! Happy to leave a review.",
      },
    },
  ],
};

export const USECASE_NL: UseCaseContent = {
  eyebrow: "Voor installatie & buitendienst",
  heading: "Van eerste klik tot trouwe klant",
  sub: "Eén flow, volledig automatisch. Zo draait een installatiebedrijf op Yippie.",
  prev: "Terug",
  next: "Volgende",
  sentLabel: "Automatisch verstuurd",
  replyLabel: "Reactie van klant",
  steps: [
    {
      tag: "Aanvraag",
      callout: "Formulier verstuurd",
      title: "De aanvraag komt binnen",
      desc: "Een bezoeker vult het formulier op je eigen website in. Zodra hij op verzenden klikt, vangt Yippie het op, geen overtypen en geen verloren lead.",
      img: "/usecase/step1_form.png",
      w: 2000,
      h: 1051,
      url: "mylastbike.com",
    },
    {
      tag: "Interesse",
      callout: "Nieuw contact → Interested",
      title: "Interesse binnen",
      desc: "Yippie maakt automatisch het contact aan en zet het direct in je pijplijn onder Interested. Niets glipt er doorheen.",
      img: "/usecase/step2_kanban.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "Opvolging",
      callout: "Twee actieknoppen",
      title: "Eén mail, twee keuzes",
      desc: "Je verkoper stuurt een opvolgmail met twee knoppen: plan een afspraak, of herinner mij over een maand. Gemaakt in de Yippie mailontwerper.",
      img: "/usecase/step3_email.png",
      w: 1440,
      h: 600,
    },
    {
      tag: "Boeken",
      callout: "Klant kiest een moment",
      title: "De klant plant zelf",
      desc: "Hij kiest zelf een moment dat past. De planning bepaalt de beschikbaarheid, en monteurs plannen zichzelf op de boekingen.",
      img: "/usecase/step4_booking.png",
      w: 1440,
      h: 900,
    },
    {
      tag: "Geboekt",
      callout: "Automatische faseverschuiving",
      title: "Geboekt, bevestigd, herinnerd",
      desc: "Het contact schuift vanzelf naar Booked, en een bevestiging met voorbereiding plus herinneringen (een week en een dag ervoor) gaan automatisch de deur uit.",
      img: "/usecase/step5_booked.png",
      w: 1440,
      h: 900,
      email: {
        direction: "out",
        from: "My Last Bike",
        subject: "Je afspraak is bevestigd ✓",
        body: "Hoi Jan, je staat gepland voor di 12 aug om 10:00. Zo bereid je je voor voordat we langskomen…",
      },
    },
    {
      tag: "After sales",
      callout: "Klaar → After sales",
      title: "Na de klus",
      desc: "Installatie klaar. Het contact schuift naar After sales, klaar voor een review, een upsell of een opvolgflow.",
      img: "/usecase/step6_aftersales.png",
      w: 1440,
      h: 900,
      email: {
        direction: "in",
        from: "Jan de Vries",
        subject: "Re: Hoe ging het?",
        body: "Helemaal klaar en rijdt perfect, bedankt voor de goede service! Ik laat graag een review achter.",
      },
    },
  ],
};
