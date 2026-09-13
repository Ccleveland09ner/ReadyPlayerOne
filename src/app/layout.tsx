import type { Metadata } from "next";
import { Nunito, Press_Start_2P } from "next/font/google";
import "./globals.css";

// Two faces: the pixel face carries every heading, label and line of prose
// the screens actually show, and the body face is the fallback for anything
// long-form. The rounded display face the first pass used for headings and
// option text is gone -- those are pixel-set now, so nothing loaded it.
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReadyPlayerOne",
  description:
    "Turn any public GitHub repository into a cited, scored quiz. Code. Learn. Level up.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${nunito.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
