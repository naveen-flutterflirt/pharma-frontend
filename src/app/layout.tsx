import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "[Distributor] DMS",
  description: "Pharma Distribution Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-gray-50 antialiased text-gray-900">
      <body className={`${inter.className} min-h-screen flex flex-col md:flex-row bg-[#f6f8f9]`}>
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
