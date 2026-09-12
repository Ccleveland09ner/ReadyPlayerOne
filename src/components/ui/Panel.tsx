import type { CSSProperties, ReactNode } from "react";

/** The framed CRT-style panel every screen sits inside. */
export function Panel({
  tone = "dark",
  className = "",
  style,
  children,
}: {
  /** Quiz and home panels are light-on-dark inverted; the rest are dark. */
  tone?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const toneStyle: CSSProperties =
    tone === "light"
      ? { background: "var(--color-parchment)" }
      : { background: "rgba(16,13,44,0.95)", borderColor: "var(--color-neon-blue)" };

  return (
    <div className={`pixel-frame animate-in w-full ${className}`} style={{ ...toneStyle, ...style }}>
      {children}
    </div>
  );
}

/** A bordered sub-panel inside a dark Panel — used by results, report, settings. */
export function SubPanel({
  title,
  icon,
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{ border: "2px solid rgba(74,120,255,0.4)", background: "rgba(20,17,54,0.6)" }}
    >
      <h3 className="text-pixel mb-4 flex items-center gap-2 text-[11px] tracking-wide text-[#8fa0e6]">
        {icon ? <span className="text-base">{icon}</span> : null}
        {title}
      </h3>
      {children}
    </div>
  );
}
