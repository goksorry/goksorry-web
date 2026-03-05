import type { Metadata } from "next";
import Link from "next/link";
import "@/app/globals.css";
import { AuthControls } from "@/components/auth-controls";

export const metadata: Metadata = {
  title: "goksorry.com MVP",
  description: "Sentiment feed + community MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <header className="header">
            <nav className="nav">
              <Link className="brand" href="/">
                goksorry.com
              </Link>
              <Link href="/">Feed</Link>
              <Link href="/community">Community</Link>
              <Link href="/admin/reports">Admin Reports</Link>
            </nav>
            <div className="auth">
              <AuthControls />
            </div>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
