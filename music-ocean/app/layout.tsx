import type { Metadata } from "next";
import {headers} from "next/headers";
import {languageForHost} from "@/lib/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "小视感 · 音乐海洋 | Music Ocean",
  description: "弹下几个音，让旋律去很远的地方。Play a little melody. Wander into an ocean of music.",
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders=await headers();
  const lang=languageForHost(requestHeaders.get("host")||"");
  return (
    <html lang={lang==="en"?"en":"zh-CN"}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
