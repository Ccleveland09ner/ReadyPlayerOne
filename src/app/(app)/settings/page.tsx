import { UserIcon } from "@/components/ui/Icons";
import { Panel } from "@/components/ui/Panel";
import { currentSettingsProfile } from "@/lib/auth/session";
import { SettingsForm } from "./settings-form";

/** Screen 12 — Settings. */
export default async function SettingsPage() {
  const profile = await currentSettingsProfile();

  return (
    <Panel className="max-w-5xl p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="text-4xl text-[#8fa0e6]">
          <UserIcon />
        </span>
        <div>
          <h1 className="text-pixel text-2xl text-white sm:text-3xl">SETTINGS</h1>
          <p className="text-pixel mt-2 text-[9px] tracking-wide text-[#8fa0e6]">
            CUSTOMIZE YOUR EXPERIENCE.
          </p>
        </div>
      </div>
      <SettingsForm profile={profile} />
    </Panel>
  );
}
