import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "./ThemeProvider";

export const metadata: Metadata = {
  title: "Pactum",
  description: "The contract platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
