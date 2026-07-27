import type { Metadata } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

// Three weights, not the whole variable axis. The type scale only ever asks for 400/500/600.
const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-sans",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "VaxTrace", template: "%s · VaxTrace" },
  description: "শিশুদের টিকাদান ট্র্যাকিং",
};

// Applies the persisted theme before first paint. Doing this in an effect — as the admin
// ThemeToggle used to — means the server always renders dark and a light-mode user gets a
// dark flash on every single navigation. It also has to run on <html>, not on a div inside
// the admin subtree, or auth, /account and the worker console stay light while admin is dark.
// The sidebar rail rides along for the same reason: read after hydration it would either
// flash open then snap shut, or need a setState in an effect. Set as an attribute before
// paint, it is a pure CSS state and React never has to hold it.
const BOOT_SCRIPT = `try{var d=document.documentElement;d.dataset.theme=localStorage.getItem('vt-theme')==='light'?'light':'dark';if(localStorage.getItem('vt-sidebar')==='collapsed')d.dataset.sidebar='collapsed'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      data-theme="dark"
      suppressHydrationWarning
      className={`${notoSansBengali.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
