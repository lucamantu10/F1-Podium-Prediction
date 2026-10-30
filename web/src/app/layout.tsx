import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: {
    default: "F1 Podium Predictor",
    template: "%s | F1 Podium Predictor",
  },
  description:
    "Podium and win probabilities for every Formula 1 race, from a model that only knows what was known before the lights went out.",
};

const NAV = [
  { href: "/", label: "Next race" },
  { href: "/seasons", label: "Seasons" },
  { href: "/model", label: "How it works" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
            <Link href="/" className="type-wide text-lg font-extrabold tracking-tight">
              F1 Podium Predictor
            </Link>
            <nav aria-label="Main">
              <ul className="flex gap-1 text-sm text-ink-2">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="rounded px-3 py-2 hover:bg-asphalt-2 hover:text-paint"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-3 sm:px-6">
            Race data from the Ergast archive and the Jolpica API. Predictions are model
            estimates, not betting advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
