import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ChipProvider } from "@/context/ChipContext";

export const metadata: Metadata = {
  title: "XCasino - Free Social Casino",
  description: "Play poker, blackjack, roulette and slots with friends. No real money gambling - just fun!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <ChipProvider>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
        </ChipProvider>
      </body>
    </html>
  );
}
