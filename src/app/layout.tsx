import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: { default: "Codex Unit", template: "%s | Codex Unit" },
  description: "Fundação segura e multiempresa para gestão de reservas e locações.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${manrope.variable} min-h-screen font-[var(--font-body)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
