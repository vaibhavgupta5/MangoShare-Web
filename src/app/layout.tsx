import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MangoShare - Secure P2P File Transfer",
  description: "Share files instantly and securely between devices using MangoShare. No registration required, end-to-end encrypted peer-to-peer file transfer.",
  keywords: ["file sharing", "P2P", "secure transfer", "instant sharing", "no signup", "encrypted"],
  authors: [{ name: "MangoShare Team" }],
  creator: "MangoShare",
  publisher: "MangoShare",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mangoshare.dev",
    title: "MangoShare - Secure P2P File Transfer",
    description: "Share files instantly and securely between devices using MangoShare. No registration required, end-to-end encrypted peer-to-peer file transfer.",
    siteName: "MangoShare",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MangoShare - Secure P2P File Transfer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MangoShare - Secure P2P File Transfer",
    description: "Share files instantly and securely between devices using MangoShare. No registration required, end-to-end encrypted peer-to-peer file transfer.",
    images: ["/og-image.png"],
    creator: "@mangoshare",
  },
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} antialiased terminal-style`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="cyber-grid min-h-screen">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
