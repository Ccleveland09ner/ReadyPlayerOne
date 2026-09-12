import type { CSSProperties, ReactNode } from "react";

/**
 * The framed panel every screen sits inside — square corners and a
 * stair-stepped outline drawn in box-shadow, the same construction as the auth
 * cards and the arcade buttons.
 *
 * Both tones drive .panel-8bit through custom properties rather than each
 * carrying its own box-shadow stack, so the step width stays in one place.
 */
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
  const toneStyle = {
    "--panel-bg": tone === "light" ? "var(--color-parchment)" : "rgba(16,13,44,0.95)",
    "--panel-accent": tone === "light" ? "#c7cbe4" : "var(--color-neon-blue)",
    "--panel-hi": tone === "light" ? "#ffffff" : "rgba(255,255,255,0.1)",
    "--panel-lo": tone === "light" ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.45)",
  } as CSSProperties;

  return (
    <div className={`panel-8bit animate-in w-full ${className}`} style={{ ...toneStyle, ...style }}>
      {children}
    </div>
  );
}

/** A stepped sub-panel inside a dark Panel — used by results, report, settings. */
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
    <div className={`box-8bit p-5 ${className}`}>
      <h3 className="text-pixel mb-4 flex items-center gap-2 text-[11px] tracking-wide text-[#8fa0e6]">
        {icon ? <span className="text-base">{icon}</span> : null}
        {title}
      </h3>
      {children}
    </div>
  );
}
