"use client";

/* Live miniature Yippie workspace preview, used on /custom.
   The visitor personalises it (colour, logo, company name) and watches
   modules slot into the sidebar as they build their package. */

import { usePathname } from "next/navigation";
import styles from "./MiniYippie.module.css";
import { getLocale } from "@/lib/i18n";
import {
  InboxIcon,
  UsersIcon,
  AiIcon,
  TicketIcon,
  ChatIcon,
  CalendarIcon,
  KanbanIcon,
  MailTrackIcon,
  TeamIcon,
  BillingIcon,
  ContractIcon,
  TrackingIcon,
  SalesIcon,
  SaasIcon,
} from "./icons";

export type MiniModuleKey =
  | "ai" | "tickets" | "chat" | "calendar" | "pipeline" | "marketing"
  | "departments" | "billing" | "contracts" | "tracking" | "sales" | "saas";

type IconComponent = (p: { size?: number }) => JSX.Element;

/* Fixed sidebar order so icons always slide into the same slot. */
const MODULE_ICON_LIST: { key: MiniModuleKey; Icon: IconComponent }[] = [
  { key: "ai",          Icon: AiIcon        },
  { key: "tickets",     Icon: TicketIcon    },
  { key: "chat",        Icon: ChatIcon      },
  { key: "calendar",    Icon: CalendarIcon  },
  { key: "pipeline",    Icon: KanbanIcon    },
  { key: "marketing",   Icon: MailTrackIcon },
  { key: "departments", Icon: TeamIcon      },
  { key: "billing",     Icon: BillingIcon   },
  { key: "contracts",   Icon: ContractIcon  },
  { key: "tracking",    Icon: TrackingIcon  },
  { key: "sales",       Icon: SalesIcon     },
  { key: "saas",        Icon: SaasIcon      },
];

const miniCopy = {
  nl: {
    moduleLabels: {
      ai: "AI Inbox",
      tickets: "Tickets",
      chat: "Live Chat",
      calendar: "Agenda",
      pipeline: "Pipeline",
      marketing: "Marketing",
      departments: "Afdelingen",
      billing: "Facturatie",
      contracts: "Contracten",
      tracking: "Zendingtracking",
      sales: "Sales",
      saas: "SaaS Analytics",
    } as Record<MiniModuleKey, string>,
    inboxRows: [
      { sender: "Acme BV", subject: "Vraag over factuur", tone: "brand" },
      { sender: "TechCorp", subject: "Inlogprobleem", tone: "amber" },
      { sender: "Nordex", subject: "Abonnement upgraden", tone: "green" },
    ],
    statOpen: "Open",
    statPending: "In behandeling",
    statResolved: "Opgelost",
    workspace: "Je werkruimte",
  },
  en: {
    moduleLabels: {
      ai: "AI Inbox",
      tickets: "Tickets",
      chat: "Live Chat",
      calendar: "Calendar",
      pipeline: "Pipeline",
      marketing: "Marketing",
      departments: "Departments",
      billing: "Billing",
      contracts: "Contracts",
      tracking: "Shipment Tracking",
      sales: "Sales",
      saas: "SaaS Analytics",
    } as Record<MiniModuleKey, string>,
    inboxRows: [
      { sender: "Acme BV", subject: "Invoice question", tone: "brand" },
      { sender: "TechCorp", subject: "Login issue", tone: "amber" },
      { sender: "Nordex", subject: "Plan upgrade", tone: "green" },
    ],
    statOpen: "Open",
    statPending: "Pending",
    statResolved: "Resolved",
    workspace: "Your workspace",
  },
} as const;

type Props = {
  brandColor: string;
  logoUrl: string | null;
  companyName: string;
  modules: MiniModuleKey[];
};

export default function MiniYippie({ brandColor, logoUrl, companyName, modules }: Props) {
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = miniCopy[locale];

  const name = companyName.trim() || t.workspace;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={styles.frame} aria-hidden="true">
      <div className={styles.frameBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.frameUrl}>app.getyippie.com</span>
      </div>
      <div className={styles.app}>
        <div className={styles.sidebar} style={{ background: brandColor }}>
          {/* Core modules — always on, Inbox active */}
          <span className={`${styles.navItem} ${styles.navActive}`} style={{ color: brandColor }}>
            <InboxIcon size={15} />
          </span>
          <span className={styles.navItem}>
            <UsersIcon size={15} />
          </span>
          <span className={styles.navDivider} />
          {/* Add on modules slide in and out as they are toggled */}
          {MODULE_ICON_LIST.map(({ key, Icon }) => {
            const on = modules.includes(key);
            return (
              <span
                key={key}
                title={t.moduleLabels[key]}
                className={`${styles.navItem} ${styles.navModule} ${on ? styles.navModuleOn : ""}`}
              >
                <Icon size={15} />
              </span>
            );
          })}
        </div>
        <div className={styles.main}>
          <div className={styles.top}>
            <span className={styles.workspace}>
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt="" className={styles.logo} />
              ) : (
                <span className={styles.logoFallback} style={{ background: brandColor }}>
                  {initial}
                </span>
              )}
              <span className={styles.workspaceName}>{name}</span>
            </span>
            <span className={styles.avatar} style={{ background: brandColor }} />
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t.statOpen}</span>
              <span className={styles.statVal} style={{ color: brandColor }}>12</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t.statPending}</span>
              <span className={`${styles.statVal} ${styles.amber}`}>4</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t.statResolved}</span>
              <span className={`${styles.statVal} ${styles.green}`}>31</span>
            </div>
          </div>
          <div className={styles.list}>
            {t.inboxRows.map((row) => (
              <div key={row.sender} className={styles.row}>
                <span
                  className={styles.rowDot}
                  style={row.tone === "brand" ? { background: brandColor } : undefined}
                  data-tone={row.tone}
                />
                <span className={styles.rowText}>
                  <span className={styles.rowSender}>{row.sender}</span>
                  <span className={styles.rowSubject}>{row.subject}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
