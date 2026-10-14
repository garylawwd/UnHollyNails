import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UnHolly Nails",
  description: "Luxury Press-On Artistry",
};

import GlobalHeader from "@/components/GlobalHeader";
import GlobalFooter from "@/components/GlobalFooter";
import { CartProvider } from "@/context/CartContext";
import { AdminProvider } from "@/context/AdminContext";
import { WishlistProvider } from "@/context/WishlistContext";
import CartDrawer from "@/components/CartDrawer";
import GlobalProductEditor from "@/components/GlobalProductEditor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased min-h-full flex flex-col`}>
        <AdminProvider>
          <WishlistProvider>
            <CartProvider>
              <GlobalHeader />
              <CartDrawer />
              <main className="flex-grow flex flex-col">
                {children}
              </main>
              <GlobalFooter />
              <GlobalProductEditor />
            </CartProvider>
          </WishlistProvider>
        </AdminProvider>
      </body>
    </html>
  );
}
