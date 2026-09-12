import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  icon,
  ...props
}: { icon: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xl text-[#e3c8ff]"
        style={{ background: "rgba(124,92,255,0.18)", border: "2px solid rgba(255,63,164,0.5)" }}
      >
        {icon}
      </span>
      <input className="pixel-input" {...props} />
    </label>
  );
}
