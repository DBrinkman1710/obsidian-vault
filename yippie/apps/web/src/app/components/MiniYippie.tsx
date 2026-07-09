/* Live miniature Yippie workspace preview, used on /custom.
   The visitor personalises it (colour, logo, company name) and watches
   modules slot into the sidebar as they build their package. */

import styles from "./MiniYippie.module.css";
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
const MODULE_ICONS: { key: MiniModuleKey; Icon: IconComponent; label: string }[] = [
  { key: "ai",          Icon: AiIcon,        label: "AI Inbox" },
  { key: "tickets",     Icon: TicketIcon,    label: "Tickets" },
  { key: "chat",        Icon: ChatIcon,      label: "Live Chat" },
  { key: "calendar",    Icon: CalendarIcon,  label: "Calendar" },
  { key: "pipeline",    Icon: KanbanIcon,    label: "Pipeline" },
  { key: "marketing",   Icon: MailTrackIcon, label: "Marketing" },
  { key: "departments", Icon: TeamIcon,      label: "Departments" },
  { key: "billing",     Icon: BillingIcon,   label: "Billing" },
  { key: "contracts",   Icon: ContractIcon,  label: "Contracts" },
  { key: "tracking",    Icon: TrackingIcon,  label: "Shipment Tracking" },
  { key: "sales",       Icon: SalesIcon,     label: "Sales" },
  { key: "saas",        Icon: SaasIcon,      label: "SaaS Analytics" },
];

const INBOX_ROWS = [
  { sender: "Acme BV", subject: "Invoice question", tone: "brand" },
  { sender: "TechCorp", subject: "Login issue", tone: "amber" },
  { sender: "Nordex", subject: "Plan upgrade", tone: "green" },
];

type Props = {
  brandColor: string;
  logoUrl: string | null;
  companyName: string;
  modules: MiniModuleKey[];
};

export default function MiniYippie({ brandColor, logoUrl, companyName, modules }: Props) {
  const name = companyName.trim() || "Your workspace";
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
          {MODULE_ICONS.map(({ key, Icon, label }) => {
            const on = modules.includes(key);
            return (
              <span
                key={key}
                title={label}
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
              <span className={styles.statLabel}>Open</span>
              <span className={styles.statVal} style={{ color: brandColor }}>12</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Pending</span>
              <span className={`${styles.statVal} ${styles.amber}`}>4</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Resolved</span>
              <span className={`${styles.statVal} ${styles.green}`}>31</span>
            </div>
          </div>
          <div className={styles.list}>
            {INBOX_ROWS.map((row) => (
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
