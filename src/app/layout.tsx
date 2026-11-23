import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overturned: appeal a Medicare Advantage denial",
  description:
    "Paste or photograph a Medicare Advantage denial letter. Get a plain-language explanation, a first-draft appeal letter and your deadline, in English or Korean (한국어). Not legal or medical advice.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f2e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
