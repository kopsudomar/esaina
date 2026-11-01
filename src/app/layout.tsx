import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "./query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ESAINA — Explainable Essay Assessment",
  description:
    "Platform penilaian esai: AI menyiapkan draf skor, guru memutuskan, siswa melihat hasil terbit.",
  icons: { icon: "/logo-mark.png", shortcut: "/logo-mark.png", apple: "/logo-mark.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
