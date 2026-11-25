import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "職域圖譜｜工程師職缺與技能需求", template: "%s｜職域圖譜" },
  description: "從台灣工程師職缺查看技能需求、市場變化，以及符合自己經驗的工作。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>
        <a className="atlas-skip" href="#atlas-content">
          跳到主要內容
        </a>
        <Suspense
          fallback={
            <header className="atlas-header">
              <div className="atlas-header-inner">
                <a className="atlas-brand" href="/">
                  職域圖譜
                </a>
              </div>
            </header>
          }
        >
          <SiteHeader />
        </Suspense>
        <div id="atlas-content">{children}</div>
      </body>
    </html>
  );
}
