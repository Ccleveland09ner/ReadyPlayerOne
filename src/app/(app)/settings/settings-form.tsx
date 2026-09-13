"use client";

import {
  useActionState,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { ClearHistory } from "@/components/settings/ClearHistory";
import { ArchiveIcon, GamepadIcon, InfoIcon, KeyIcon, UserIcon } from "@/components/ui/Icons";
import { SubPanel } from "@/components/ui/Panel";
import { updateProfileAction, type ProfileState } from "@/lib/auth/profile-actions";
import type { SettingsProfile } from "@/lib/auth/session";

/**
 * Screen 12 — Settings.
 *
 * PROFILE is backed by the schema (`profiles.username`,
 * `profiles.display_name`), and Clear Quiz History really deletes. Quiz
 * Preferences, Export and Account are P2 with nothing reading them yet, so
 * they stay presentational and say so rather than pretending to save.
 */
export function SettingsForm({
  profile,
  quizzes,
}: {
  profile: SettingsProfile;
  quizzes: number;
}) {
  const [explanations, setExplanations] = useState(true);
  const [snippets, setSnippets] = useState(true);
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    {},
  );

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <SubPanel title="PROFILE" icon={<UserIcon />}>
        {profile.userId ? (
          <form action={formAction} className="flex flex-col gap-3">
            <Row label="Username">
              <Input
                name="username"
                defaultValue={profile.username ?? ""}
                placeholder="player_name"
              />
            </Row>
            <Row label="Display Name">
              <Input name="displayName" defaultValue={profile.displayName} required />
            </Row>
            <Row label="Email">
              {/* Changing an email is an auth flow with a confirmation round
                  trip, not a profile write. Shown, not editable. */}
              <Input defaultValue={profile.email ?? ""} disabled />
            </Row>
            {state.error ? <StatusLine tone="error">{state.error}</StatusLine> : null}
            {state.saved ? <StatusLine tone="ok">Saved.</StatusLine> : null}
            <div className="mt-2 flex justify-end">
              <SaveButton />
            </div>
          </form>
        ) : (
          <p className="text-pixel text-[9px] leading-relaxed tracking-wide text-[#b7b2e6]">
            You are playing anonymously. Runs are saved to this browser — create
            a profile to keep them and set a display name.
          </p>
        )}
      </SubPanel>

      <SubPanel title="QUIZ PREFERENCES (NOT YET SAVED)" icon={<GamepadIcon />}>
        <div className="flex flex-col gap-3">
          <Row label="Default Number of Questions">
            <Select options={["5", "10", "15", "20"]} />
          </Row>
          <Row label="Difficulty Level">
            <Select options={["Mixed", "Easy", "Medium", "Hard"]} />
          </Row>
          <Row label="Include Explanations">
            <Toggle on={explanations} onChange={setExplanations} />
          </Row>
          <Row label="Show Code Snippets">
            <Toggle on={snippets} onChange={setSnippets} />
          </Row>
          <Row label="Time Limit (per question)">
            <Select options={["No Limit", "30s", "60s", "90s"]} />
          </Row>
        </div>
      </SubPanel>

      <div className="flex flex-col gap-4">
        <SubPanel title="DATA & PRIVACY" icon={<ArchiveIcon />}>
          <div className="flex flex-col gap-3">
            <Row label="Clear Quiz History">
              <ClearHistory quizzes={quizzes} />
            </Row>
            <Row label="Export My Data (P2)">
              <button type="button" className="btn-pixel btn-8bit btn-gold !py-2 !text-[9px]">
                EXPORT (JSON)
              </button>
            </Row>
          </div>
        </SubPanel>

        <SubPanel title="ACCOUNT (P2)" icon={<KeyIcon />}>
          <div className="flex flex-col gap-3">
            <Row label="Change Password">
              <button type="button" className="btn-pixel btn-8bit btn-ghost !py-2 !text-[9px]">
                CHANGE PASSWORD
              </button>
            </Row>
            <Row label="Delete Account">
              <button
                type="button"
                className="btn-pixel btn-8bit !py-2 !text-[9px]"
                style={
                  {
                    background: "transparent",
                    color: "#ff5470",
                    "--btn-edge": "#ff5470",
                  } as CSSProperties
                }
              >
                DELETE ACCOUNT
              </button>
            </Row>
          </div>
        </SubPanel>

        <SubPanel title="ABOUT" icon={<InfoIcon />}>
          <div className="text-pixel flex justify-between text-[10px] tracking-wide text-[#b7b2e6]">
            <span>Version</span>
            <span className="text-white">v1.0.0</span>
          </div>
          <div className="text-pixel flex justify-between text-[10px] tracking-wide text-[#b7b2e6]">
            <span>Built with</span>
            <span className="text-white">for learners</span>
          </div>
        </SubPanel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-pixel text-[10px] tracking-wide text-[#cbc6f0]">{label}</span>
      {children}
    </div>
  );
}

const fieldStyle = {
  "--box-bg": "rgba(9,7,26,0.6)",
  "--box-edge": "rgba(74,120,255,0.5)",
} as CSSProperties;

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="box-8bit text-pixel px-3 py-2 text-[10px] tracking-wide text-white outline-none"
      style={{ ...fieldStyle, minWidth: 200 }}
      {...props}
    />
  );
}

function Select({ options }: { options: string[] }) {
  return (
    <select
      className="box-8bit text-pixel px-3 py-2 text-[10px] tracking-wide text-white outline-none"
      style={{ ...fieldStyle, minWidth: 130 }}
      defaultValue={options[0]}
    >
      {options.map((o) => (
        <option key={o} className="bg-[#14113a]">
          {o}
        </option>
      ))}
    </select>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2" aria-pressed={on}>
      <span
        className="box-8bit relative h-7 w-12 transition"
        style={
          {
            "--box-bg": on ? "var(--color-grape)" : "#2f2a63",
            "--box-edge": on ? "var(--color-grape-deep)" : "#1a1638",
          } as CSSProperties
        }
      >
        <span
          className="absolute top-1 h-5 w-5 bg-white transition-all"
          style={{ left: on ? 26 : 4 }}
        />
      </span>
      <span className="text-pixel text-[10px] tracking-wide text-white">{on ? "On" : "Off"}</span>
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-pixel btn-8bit btn-gold !py-2 !text-[10px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "SAVING…" : "SAVE CHANGES"}
    </button>
  );
}

function StatusLine({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  const color = tone === "error" ? "#ff5470" : "#4ade80";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className="text-pixel text-[9px] leading-relaxed tracking-wide"
      style={{ color }}
    >
      {children}
    </p>
  );
}
