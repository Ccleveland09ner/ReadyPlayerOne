// Small inline pixel-flavored icons. Kept stroke-based so they scale crisply
// alongside the pixel type without shipping an icon dependency.
type P = { className?: string };
const base = "inline-block align-middle";

export const HomeIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" />
  </svg>
);
export const ClockIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
export const GamepadIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="10" rx="4" /><path d="M7 11v2M6 12h2M15 11h.01M18 13h.01" />
  </svg>
);
export const ChartIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
export const GearIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
  </svg>
);
export const BranchIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="8" r="2.4" /><path d="M6 8.4v7.2M18 10.4c0 4-3 4-6 4.6" />
  </svg>
);
export const CodeIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </svg>
);
export const DocIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" />
  </svg>
);
export const ChevronDown = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6" />
  </svg>
);
export const Cross = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const MailIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
  </svg>
);
export const LockIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" />
  </svg>
);
export const UserIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);
export const TargetIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" />
  </svg>
);
export const Arrow = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h14M13 6l6 6-6 6" />
  </svg>
);
export const Play = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} width="1em" height="1em" fill="currentColor">
    <path d="M7 5l12 7-12 7z" />
  </svg>
);

// Emoji glyphs — no stroke geometry, so they just carry the class through.
export const Trophy = ({ className }: P) => (
  <span className={`${base} ${className ?? ""}`} role="img" aria-label="trophy">🏆</span>
);
export const Flame = ({ className }: P) => (
  <span className={`${base} ${className ?? ""}`} role="img" aria-label="streak">🔥</span>
);
export const Bulb = ({ className }: P) => (
  <span className={`${base} ${className ?? ""}`} role="img" aria-label="hint">💡</span>
);
export const Heart = ({ filled = true, className }: P & { filled?: boolean }) => (
  <span
    className={`${base} ${className ?? ""}`}
    role="img"
    aria-label={filled ? "heart remaining" : "heart lost"}
    style={filled ? undefined : { filter: "grayscale(1)", opacity: 0.35 }}
  >
    ❤️
  </span>
);
