import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "In viaggio per l'Italia - Depot",
  description: "Portail pedagogique d'italien pour consulter les sequences, activites et ressources."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
