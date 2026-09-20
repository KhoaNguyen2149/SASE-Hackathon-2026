import type { Metadata, Viewport } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./globals.css";
import { Provider } from "@/components/provider";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: {
    default: "DeskHop — Find your next study spot.",
    template: "%s · DeskHop",
  },
  description:
    "Find a place that fits your study session. Browse spots across Colorado, reserve a room where we support it, and study alongside friends.",
  applicationName: "DeskHop",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/deskhop-app-icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#285547",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="deskhop">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Provider>
          <Shell>{children}</Shell>
        </Provider>
      </body>
    </html>
  );
}
