import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  icon,
  ...props
}: { icon: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-3">
      <span className="icon-chip-8bit flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[#e3c8ff]">
        {icon}
      </span>
      <input className="pixel-input" {...props} />
    </label>
  );
}
