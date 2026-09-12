"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Brand";
import {
  ChartIcon,
  ClockIcon,
  GamepadIcon,
  GearIcon,
  HomeIcon,
} from "@/components/ui/Icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => ReactNode;
  /** Any pathname starting with one of these marks the item active. */
  match: string[];
};

const NAV: NavItem[] = [
  { href: "/", label: "Home", Icon: HomeIcon, match: ["/"] },
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
    <aside className="pixel-panel-dark m-3 flex shrink-0 flex-col gap-6 rounded-xl p-5 lg:m-4 lg:w-64">
      <div className="px-1 pt-1">
        <Link href="/" aria-label="ReadyPlayerOne home">
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
              className={`text-display flex items-center gap-3 rounded-lg px-4 py-3 text-lg font-semibold transition ${
                on ? "text-white" : "text-[#b7b2e6] hover:text-white"
              }`}
              style={
                on
                  ? {
                      background: "rgba(124,92,255,0.28)",
                      border: "2px solid var(--color-grape)",
                      boxShadow: "0 0 16px rgba(124,92,255,0.45)",
                    }
                  : { border: "2px solid transparent" }
              }
            >
              <Icon className="text-[1.35rem]" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
