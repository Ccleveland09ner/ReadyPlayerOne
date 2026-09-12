import { DashboardShell } from "@/components/shell/DashboardShell";

/** Every screen in this group renders inside the game shell. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <DashboardShell>{children}</DashboardShell>;
}
