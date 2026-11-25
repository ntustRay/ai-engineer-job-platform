"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "./icons";

const nav = [
  { key: "jobs", label: "職缺探索", href: "/" },
  { key: "trends", label: "市場趨勢", href: "/?view=trends" },
  { key: "skills", label: "我的技能", href: "/?view=skills" },
  { key: "resume", label: "履歷工作室", href: "/resume" },
];

export function SiteHeader() {
  const path = usePathname();
  const search = useSearchParams();
  const active = path === "/" ? search.get("view") || "jobs" : path.split("/")[1];
  return (
    <header className="atlas-header">
      <div className="atlas-header-inner">
        <Link className="atlas-brand" href="/" aria-label="職域圖譜首頁">
          <span className="atlas-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          職域圖譜
        </Link>
        <nav className="atlas-nav" aria-label="主要導覽">
          {nav.map((item) => (
            <Link href={item.href} key={item.key} aria-current={active === item.key ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="atlas-account-link"
          href="/account"
          aria-current={active === "account" ? "page" : undefined}
        >
          <Icon name="user" size={16} />
          帳號
        </Link>
      </div>
    </header>
  );
}
