"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { GamepadIcon, UserIcon } from "@/components/ui/Icons";
import { SubPanel } from "@/components/ui/Panel";

/**
 * Screen 12 — Settings.
 *
 * Profile and Quiz Preferences are P1 and write profiles.preferences; the
 * Appearance, Data & Privacy and Account sections are P2 and are presentational
 * on purpose — a theme switcher is three times the styling QA for a screen the
 * demo shows for four seconds.
 */
export function SettingsForm() {
  const [explanations, setExplanations] = useState(true);
  const [snippets, setSnippets] = useState(true);
  const [theme, setTheme] = useState<"Dark" | "Light" | "Retro">("Dark");
  const [accent, setAccent] = useState("#7c5cff");
  const accents = ["#7c5cff", "#3a7bff", "#4ade80", "#ffc23c", "#ff5470"];

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <SubPanel title="PROFILE" icon={<UserIcon />}>
        <div className="flex flex-col gap-3">
          <Row label="Username">
            <Input defaultValue="Player_Intern" />
          </Row>
          <Row label="Display Name">
            <Input defaultValue="Player_Intern" />
          </Row>
          <Row label="Email">
            <Input defaultValue="player@gram.edu" />
          </Row>
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn-pixel btn-gold !py-2 !text-[10px]">
              SAVE CHANGES
            </button>
          </div>
        </div>
      </SubPanel>

      <SubPanel title="APPEARANCE (P2)" icon={<span>🖥️</span>}>
        <div className="flex flex-col gap-3">
          <Row label="Theme">
            <div className="flex gap-2">
              {(["Dark", "Light", "Retro"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className="text-display rounded-md px-3 py-2 text-sm font-semibold transition"
                  style={
                    theme === t
                      ? {
                          background: "rgba(124,92,255,0.28)",
                          border: "2px solid var(--color-grape)",
                          color: "#fff",
                        }
                      : { border: "2px solid #2f2a63", color: "#b7b2e6" }
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Accent Color">
            <div className="flex gap-2">
              {accents.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  className="h-8 w-8 rounded-md transition"
                  style={{
                    background: c,
                    outline: accent === c ? "2px solid #fff" : "2px solid transparent",
                    outlineOffset: 2,
                    boxShadow: accent === c ? `0 0 12px ${c}` : "none",
                  }}
                  aria-label={`accent ${c}`}
                />
              ))}
            </div>
          </Row>
        </div>
      </SubPanel>

      <SubPanel title="QUIZ PREFERENCES" icon={<GamepadIcon />}>
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
        <SubPanel title="DATA & PRIVACY (P2)" icon={<span>🗄️</span>}>
          <div className="flex flex-col gap-3">
            <Row label="Clear Quiz History">
              <button
                type="button"
                className="btn-pixel !py-2 !text-[9px]"
                style={{
                  background: "transparent",
                  color: "#ff5470",
                  border: "2px solid #ff5470",
                  boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
                }}
              >
                CLEAR HISTORY
              </button>
            </Row>
            <Row label="Export My Data">
              <button type="button" className="btn-pixel btn-gold !py-2 !text-[9px]">
                EXPORT (JSON)
              </button>
            </Row>
          </div>
        </SubPanel>

        <SubPanel title="ACCOUNT (P2)" icon={<span>🔑</span>}>
          <div className="flex flex-col gap-3">
            <Row label="Change Password">
              <button type="button" className="btn-pixel btn-ghost !py-2 !text-[9px]">
                CHANGE PASSWORD
              </button>
            </Row>
            <Row label="Delete Account">
              <button
                type="button"
                className="btn-pixel !py-2 !text-[9px]"
                style={{
                  background: "transparent",
                  color: "#ff5470",
                  border: "2px solid #ff5470",
                  boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
                }}
              >
                DELETE ACCOUNT
              </button>
            </Row>
          </div>
        </SubPanel>

        <SubPanel title="ABOUT" icon={<span>ℹ️</span>}>
          <div className="text-display flex justify-between text-sm text-[#b7b2e6]">
            <span>Version</span>
            <span className="text-white">v1.0.0</span>
          </div>
          <div className="text-display flex justify-between text-sm text-[#b7b2e6]">
            <span>Built with</span>
            <span className="text-white">❤️ for learners</span>
          </div>
        </SubPanel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-display text-base font-medium text-[#cbc6f0]">{label}</span>
      {children}
    </div>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="text-display rounded-md px-3 py-2 text-base font-medium text-white outline-none"
      style={{
        background: "rgba(9,7,26,0.6)",
        border: "2px solid rgba(74,120,255,0.5)",
        minWidth: 200,
      }}
      {...props}
    />
  );
}

function Select({ options }: { options: string[] }) {
  return (
    <select
      className="text-display rounded-md px-3 py-2 text-base font-medium text-white outline-none"
      style={{
        background: "rgba(9,7,26,0.6)",
        border: "2px solid rgba(74,120,255,0.5)",
        minWidth: 130,
      }}
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
        className="relative h-7 w-12 rounded-full transition"
        style={{ background: on ? "var(--color-grape)" : "#2f2a63" }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: on ? 26 : 4 }}
        />
      </span>
      <span className="text-display text-base font-semibold text-white">{on ? "On" : "Off"}</span>
    </button>
  );
}
