import type { Metadata } from "next";
import { Fredoka, Nunito, Press_Start_2P } from "next/font/google";
import "./globals.css";

// Two faces in the art direction (pixel display + body), plus the rounded
// display face the reconstruction uses for headings and option text.
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
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
      className={`${pressStart.variable} ${fredoka.variable} ${nunito.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
