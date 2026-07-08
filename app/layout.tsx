import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "In viaggio per l'Italia - Depot",
  description: "Espace editeur pour organiser les sequences, activites et ressources d'italien."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
