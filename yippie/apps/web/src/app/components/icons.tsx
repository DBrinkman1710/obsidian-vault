/* Inline line-icon set — single source of truth for site icons.
   No emoji anywhere. Stroke 1.6, inherits currentColor, sized via `size`. */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const InboxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13h4l1.5 3h7L17 13h4" />
    <path d="M5 5h14l2 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z" />
  </Svg>
);

export const TicketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
    <path d="M14 6v2M14 11v2M14 16v2" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
    <path d="M9 11h6M9 14h4" />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.7" />
  </Svg>
);

export const ActivityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </Svg>
);

export const BillingIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </Svg>
);

export const AiIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" />
    <path d="M18 15l.7 1.8L20.5 17l-1.8.7L18 19l-.7-1.3L15.5 17l1.8-.2z" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
    <path d="M8 14h3v3H8z" />
  </Svg>
);

export const KanbanIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.4" />
    <rect x="10" y="4" width="5" height="10" rx="1.4" />
    <rect x="17" y="4" width="4" height="13" rx="1.4" />
  </Svg>
);

export const MailTrackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3 7l9 6 9-6" />
    <path d="M14 19l2 2 4-4" />
    <path d="M3 7v10a2 2 0 0 0 2 2h6" />
  </Svg>
);

export const TemplateIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M9 9v11" />
  </Svg>
);

export const TeamIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3" />
    <path d="M6 20a6 6 0 0 1 12 0" />
    <path d="M19 8h3M20.5 6.5v3" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 3L5 13h6l-1 8 8-10h-6z" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5M3 17l9 5 9-5" />
  </Svg>
);

export const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const TrackingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7l9-4 9 4-9 4z" />
    <path d="M3 7v8l9 4 9-4V7" />
    <path d="M12 11v8M7.5 5.2l9 4" />
  </Svg>
);

export const SalesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17l5-5 4 4 7-7" />
    <path d="M15 9h5v5" />
  </Svg>
);

export const SaasIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 8z" />
    <path d="M9 14h6M12 11v6" />
  </Svg>
);
