import { ReactQueryProvider } from "@/providers/query-client-provider";
import { Sidebar } from "@/components/Layout/Sidebar";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AutoAcct - Upload Receipts",
  description: "Automated accounting system with OCR receipt processing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <ReactQueryProvider>
          <div className="flex min-h-screen bg-bg-app font-sans antialiased text-text-primary">
            {/* Sidebar */}
            <Sidebar className="hidden md:flex" />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-screen">
              {children}
            </main>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
