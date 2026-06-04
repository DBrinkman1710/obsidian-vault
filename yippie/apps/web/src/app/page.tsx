"use client";

import { useEffect, useRef, useState } from "react";
import {
  Inbox,
  Ticket,
  MessageSquare,
  Users,
  Activity,
  CreditCard,
} from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

// ── Data ──────────────────────────────────────────────────────────────────────

const features = [
  {
    Icon: Inbox,
    title: "Smart Inbox",
    desc: "Auto-drafts every support ticket from email & WhatsApp so you spend seconds instead of minutes on every message.",
  },
  {
    Icon: Ticket,
    title: "Ticket Management",
    desc: "Track, assign, and close requests in one place. SLA alerts fire before anything slips through.",
  },
  {
    Icon: MessageSquare,
    title: "Live Chat",
    desc: "Embed a chat widget with one line of code. Every conversation lands in a single dashboard.",
  },
  {
    Icon: Users,
    title: "Contact Management",
    desc: "Full customer history — emails, tickets, invoices — visible at a glance. No inbox digging.",
  },
  {
    Icon: Activity,
    title: "Activity Feed",
    desc: "Real-time log of everything in your business. Always know who did what and when.",
  },
  {
    Icon: CreditCard,
    title: "Billing",
    desc: "Send and track invoices without leaving the platform. Support and financials, in sync.",
  },
];

const steps = [
  {
    n: "01",
    title: "Customer sends a message",
    desc: "An email or WhatsApp message lands in your Yippie inbox automatically.",
  },
  {
    n: "02",
    title: "AI drafts the ticket",
    desc: "Yippie reads the message and suggests subject, priority, and description.",
  },
  {
    n: "03",
    title: "You approve in one click",
    desc: "Edit if you want, approve — it becomes a real ticket instantly.",
  },
];

const logos = ["Acme BV", "TechCorp", "Nordex", "Bloom Agency", "Ridley Co"];

const inboxRows = [
  { sender: "Acme BV", subject: "Invoice INV-0421 question", priority: "High", status: "Open" },
  { sender: "TechCorp", subject: "Login issue — account locked", priority: "Urgent", status: "In progress" },
  { sender: "Nordex", subject: "Pricing plan upgrade", priority: "Low", status: "Resolved" },
  { sender: "Bloom Agency", subject: "Onboarding call request", priority: "Normal", status: "Open" },
  { sender: "Ridley Co", subject: "API key rotation needed", priority: "High", status: "In progress" },
];

const monthlyPrices = { Starter: "€29", Growth: "€79", Pro: "€199" };
const annualPrices  = { Starter: "€23", Growth: "€63", Pro: "€159" };

const plans = [
  {
    tier: "Starter" as const,
    desc: "For solo founders getting started",
    features: ["1 user", "500 contacts", "Inbox + Tickets", "Live chat widget", "Email support"],
    cta: "Get started",
    featured: false,
  },
  {
    tier: "Growth" as const,
    desc: "For teams handling more volume",
    features: ["5 users", "5,000 contacts", "All modules", "Activity feed", "Priority support"],
    cta: "Get started",
    featured: true,
  },
  {
    tier: "Pro" as const,
    desc: "For businesses at scale",
    features: ["Unlimited users", "Unlimited contacts", "All modules", "API access", "Dedicated support"],
    cta: "Contact us",
    featured: false,
  },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useFadeOnScroll() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const children = Array.from(el.querySelectorAll<HTMLElement>(".fade-up"));
    children.forEach((c) => {
      c.style.opacity = "0";
      c.style.transform = "translateY(8px)";
      c.style.transition = "opacity 400ms ease-out, transform 400ms ease-out";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const els = Array.from(entry.target.querySelectorAll<HTMLElement>(".fade-up"));
            els.forEach((el, i) => {
              setTimeout(() => {
                el.style.opacity = "1";
                el.style.transform = "translateY(0)";
              }, i * 80);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ── Priority badge colours ────────────────────────────────────────────────────

function priorityClass(p: string) {
  if (p === "Urgent") return "bg-red-50 text-red-600";
  if (p === "High")   return "bg-orange-50 text-orange-600";
  if (p === "Normal") return "bg-slate-100 text-slate-600";
  return "bg-slate-50 text-slate-400";
}

function statusClass(s: string) {
  if (s === "Resolved")    return "bg-emerald-50 text-emerald-600";
  if (s === "In progress") return "bg-blue-50 text-blue-500";
  return "bg-slate-100 text-slate-500";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [annual, setAnnual] = useState(false);
  const prices = annual ? annualPrices : monthlyPrices;

  const featuresRef = useFadeOnScroll();
  const stepsRef    = useFadeOnScroll();

  return (
    <>
      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Yippie" className="h-8 w-auto" />
            <span className="hidden sm:block text-sm text-slate-400">Customer support, made easy</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features"     className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">How it works</a>
            <a href="#pricing"      className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            <a
              href={APP_URL}
              className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors"
            >
              Log in →
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="bg-white py-20 md:py-32 px-6 md:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div
            style={{
              opacity: 0,
              transform: "translateY(8px)",
              animation: "heroFadeUp 400ms ease-out 50ms forwards",
            }}
          >
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-yippie/30 bg-yippie/5">
              <span className="w-1.5 h-1.5 rounded-full bg-yippie" />
              <span className="text-xs font-semibold tracking-wide text-yippie">AI customer service</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6">
              Give yourself back the time that matters
            </h1>

            <p className="text-base md:text-lg text-slate-600 leading-relaxed mb-8 max-w-md">
              Yippie auto-drafts every support ticket from your inbox.
              Review, approve, done.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href={APP_URL}
                className="px-6 py-3 rounded-xl bg-yippie text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Start for free →
              </a>
              <a
                href="#how-it-works"
                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:border-slate-400 transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right: browser chrome mockup */}
          <div className="relative flex justify-center md:justify-end">
            {/* Soft blue blur behind the frame */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-3xl bg-yippie opacity-[0.12] pointer-events-none" />

            <div
              className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
              style={{ transform: "rotate(1deg)" }}
            >
              {/* Browser chrome */}
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <div className="flex-1 mx-4 bg-white rounded text-[10px] text-slate-400 px-2 py-0.5 text-center">
                  app.getyippie.com
                </div>
              </div>

              {/* App shell */}
              <div className="flex h-72 bg-white">
                {/* Sidebar */}
                <div className="bg-yippie w-12 flex flex-col items-center pt-4 gap-2 flex-shrink-0">
                  {[true, false, false, false, false].map((active, i) => (
                    <div
                      key={i}
                      className={`w-7 h-7 rounded-lg ${active ? "bg-white/25" : "bg-white/10"}`}
                    />
                  ))}
                </div>

                {/* 2x2 card grid */}
                <div className="flex-1 grid grid-cols-2 gap-2 p-3 bg-slate-50">
                  {[
                    { label: "Customer" },
                    { label: "Email" },
                    { label: "Ticket" },
                    { label: "Reply" },
                  ].map(({ label }) => (
                    <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
                      <div className="text-[9px] font-semibold text-slate-400 mb-2 uppercase tracking-widest">{label}</div>
                      <div className="space-y-1.5">
                        <div className="h-1.5 bg-slate-100 rounded-full w-3/4" />
                        <div className="h-1.5 bg-slate-100 rounded-full w-1/2" />
                        <div className="h-1.5 bg-slate-100 rounded-full w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logo bar ───────────────────────────────────────────── */}
      <div className="bg-slate-50 border-y border-slate-100 py-8 px-6 md:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-5">
            Teams at these businesses use Yippie
          </p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-2">
            {logos.map((name) => (
              <span key={name} className="text-sm font-medium text-slate-400">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="bg-white py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          {[
            { value: "10h+",   label: "saved per week per person" },
            { value: "<2 min", label: "average ticket response time" },
            { value: "6",      label: "modules, one platform" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-5xl md:text-6xl font-bold text-yippie tracking-tight mb-3">{s.value}</div>
              <div className="text-sm text-slate-500 leading-relaxed">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="bg-slate-50 py-20 md:py-32 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold tracking-widest uppercase text-yippie mb-3 text-center">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center mb-4">
            Everything your support team needs
          </h2>
          <p className="text-base md:text-lg text-slate-600 text-center leading-relaxed max-w-xl mx-auto mb-16">
            One platform for inbox, tickets, live chat, contacts, billing, and activity. Stop juggling tools.
          </p>

          <div ref={featuresRef} className="grid md:grid-cols-2 gap-x-12 gap-y-10 max-w-4xl mx-auto">
            {features.map(({ Icon, title, desc }) => (
              <div key={title} className="fade-up flex gap-5 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Icon size={20} strokeWidth={1.5} className="text-yippie" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20 md:py-32 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold tracking-widest uppercase text-yippie mb-3 text-center">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center mb-4">
            From email to resolved — in seconds
          </h2>
          <p className="text-base md:text-lg text-slate-600 text-center leading-relaxed max-w-xl mx-auto mb-20">
            Yippie&apos;s AI reads every incoming message and does the write-up for you.
          </p>

          <div ref={stepsRef} className="grid md:grid-cols-3 gap-12 md:gap-6 max-w-4xl mx-auto relative">
            {/* Connector arrows (desktop) */}
            <div className="hidden md:block absolute top-6 left-[calc(33.33%-16px)] right-[calc(33.33%-16px)] pointer-events-none">
              <div className="h-px border-t border-dashed border-slate-200 w-full" />
            </div>

            {steps.map((s) => (
              <div key={s.n} className="fade-up text-center md:text-left">
                <div className="text-6xl font-bold text-yippie/20 leading-none mb-4 tracking-tight">{s.n}</div>
                <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product moment ─────────────────────────────────────── */}
      <section className="bg-slate-900 py-20 md:py-32 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white text-center mb-4">
            Everything in one place
          </h2>
          <p className="text-base md:text-lg text-slate-400 text-center leading-relaxed max-w-xl mx-auto mb-16">
            Your entire support operation — inbox, tickets, contacts, billing — unified in a single dashboard.
          </p>

          {/* Inbox mockup */}
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
            {/* Chrome bar */}
            <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <div className="flex-1 mx-4 bg-slate-700 rounded text-[10px] text-slate-500 px-2 py-0.5 text-center">
                app.getyippie.com/inbox
              </div>
            </div>

            {/* App layout */}
            <div className="flex bg-slate-900">
              {/* Sidebar */}
              <div className="bg-yippie w-14 flex-shrink-0 flex flex-col items-center pt-5 gap-3">
                {[true, false, false, false, false, false].map((active, i) => (
                  <div key={i} className={`w-8 h-8 rounded-xl ${active ? "bg-white/25" : "bg-white/10"}`} />
                ))}
              </div>

              {/* Inbox list */}
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">Inbox</span>
                  <span className="text-xs text-slate-500">{inboxRows.length} messages</span>
                </div>

                {/* Rows */}
                {inboxRows.map((row) => (
                  <div key={row.sender} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      {row.sender[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-200 truncate">{row.sender}</div>
                      <div className="text-xs text-slate-500 truncate">{row.subject}</div>
                    </div>
                    <span className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityClass(row.priority)}`}>
                      {row.priority}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white py-20 md:py-32 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold tracking-widest uppercase text-yippie mb-3 text-center">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center mb-4">
            Simple, honest pricing
          </h2>
          <p className="text-base md:text-lg text-slate-600 text-center leading-relaxed max-w-xl mx-auto mb-10">
            No hidden fees. Cancel anytime. Start free and upgrade when you grow.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-14">
            <span className={`text-sm font-medium ${!annual ? "text-slate-900" : "text-slate-400"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: annual ? "#5BA4F5" : "#e2e8f0" }}
              aria-label="Toggle annual billing"
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                style={{ transform: annual ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
            <span className={`text-sm font-medium ${annual ? "text-slate-900" : "text-slate-400"}`}>
              Annual <span className="text-yippie font-semibold">−20%</span>
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className={`relative rounded-2xl p-8 bg-white transition-shadow hover:shadow-md ${
                  plan.featured
                    ? "border-2 border-yippie shadow-sm"
                    : "border border-slate-200 shadow-sm"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yippie text-white text-xs font-semibold px-3 py-0.5 rounded-full whitespace-nowrap">
                    Most popular
                  </span>
                )}
                <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-3">{plan.tier}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-bold tracking-tight text-slate-900 transition-all duration-300">
                    {prices[plan.tier]}
                  </span>
                  <span className="text-sm text-slate-400 mb-2">/mo</span>
                </div>
                <p className="text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100 leading-relaxed">
                  {plan.desc}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-yippie font-bold mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={APP_URL}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-opacity ${
                    plan.featured
                      ? "bg-yippie text-white hover:opacity-90"
                      : "border border-slate-200 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 md:px-8" style={{ background: "#5BA4F5" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Ready to win back your time?
          </h2>
          <p className="text-base md:text-lg text-white/75 leading-relaxed mb-8">
            Join businesses that handle customer support in half the time.
            Start for free, no credit card required.
          </p>
          <a
            href={APP_URL}
            className="inline-block px-8 py-3.5 rounded-xl bg-white font-semibold text-yippie hover:opacity-90 transition-opacity"
          >
            Start for free →
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-100 px-6 md:px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Yippie" className="h-7 w-auto" />
          <div className="flex items-center gap-6 flex-wrap">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Features</a>
            <a href="#pricing"  className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Pricing</a>
            <a href={APP_URL}   className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Log in</a>
            <span className="text-sm text-slate-300">© {new Date().getFullYear()} Yippie</span>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes heroFadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
