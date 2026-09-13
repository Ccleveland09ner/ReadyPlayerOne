"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/ui/Brand";
import {
  ChartIcon,
  ClockIcon,
  GamepadIcon,
  GearIcon,
  HomeIcon,
  LogoutIcon,
} from "@/components/ui/Icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => ReactNode;
  /** Any pathname starting with one of these marks the item active. */
  match: string[];
};

const NAV: NavItem[] = [
  { href: "/home", label: "Home", Icon: HomeIcon, match: ["/home"] },
  { href: "/history", label: "History", Icon: ClockIcon, match: ["/history"] },
  { href: "/runs", label: "Quiz", Icon: GamepadIcon, match: ["/runs"] },
  { href: "/report", label: "Report", Icon: ChartIcon, match: ["/report"] },
  { href: "/settings", label: "Settings", Icon: GearIcon, match: ["/settings"] },
];

function isActive(pathname: string, match: string[]) {
  return match.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)));
}

export function SideNav({ quizHref }: { quizHref: string }) {
  const pathname = usePathname();

  return (
    <aside
      className="panel-8bit m-3 flex shrink-0 flex-col gap-6 p-5 lg:m-4 lg:h-[calc(100vh-2rem)] lg:w-64"
      style={
        {
          "--panel-bg": "rgba(16,13,44,0.95)",
          "--panel-accent": "var(--color-neon-blue)",
        } as CSSProperties
      }
    >
      <div className="px-1 pt-1">
        <Link href="/home" aria-label="ReadyPlayerOne home">
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-row flex-wrap gap-2 lg:flex-col">
        {NAV.map(({ href, label, Icon, match }) => {
          const on = isActive(pathname, match);
          return (
            <Link
              key={href}
              href={href === "/runs" ? quizHref : href}
              aria-current={on ? "page" : undefined}
              // The stepped outline is drawn in box-shadow, so the inactive
              // state needs no transparent border to hold the row height.
              className={`chip-8bit text-pixel flex items-center gap-3 px-4 py-3 text-[11px] tracking-wide transition ${
                on ? "text-white" : "text-[#b7b2e6] hover:text-white"
              }`}
              style={
                {
                  "--chip-bg": on ? "rgba(124,92,255,0.28)" : "transparent",
                  "--chip-edge": on ? "var(--color-grape)" : "#2f2a63",
                  "--chip-glow": on ? "0 0 16px rgba(124,92,255,0.45)" : "0 0 #0000",
                } as CSSProperties
              }
            >
              <Icon className="text-[1.35rem]" />
              {label}
            </Link>
          );
        })}
      </nav>
      <form action="/logout" method="POST" className="lg:mt-auto">
        <button
          type="submit"
          className="chip-8bit text-pixel flex w-full items-center gap-3 px-4 py-3 text-[11px] tracking-wide text-[#ffb3c8] transition hover:text-white"
          style={
            {
              "--chip-bg": "rgba(255,84,112,0.12)",
              "--chip-edge": "#ff5470",
            } as CSSProperties
          }
        >
          <LogoutIcon className="text-[1.35rem]" />
          Log out
        </button>
      </form>
    </aside>
  );
}
