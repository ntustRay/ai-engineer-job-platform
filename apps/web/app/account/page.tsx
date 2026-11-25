"use client";

import { useState } from "react";
import Link from "next/link";
import { createAuthClient } from "better-auth/react";
import { SKILLS } from "@job/domain";
import { useAccountProfile } from "../../lib/account-profile";
import { isPublicRepo, type PublicRepo } from "../../lib/account-repos";
import styles from "./profile.module.css";

const auth = createAuthClient();

export default function AccountPage() {
  const { mode, profile, ready, name, error, loginAvailable, updateProfile } = useAccountProfile();
  const [sessionBusy, setSessionBusy] = useState(false);
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoPage, setRepoPage] = useState<number | null>(1);
  const [repos, setRepos] = useState<PublicRepo[]>([]);
  const [message, setMessage] = useState("");

  async function toggleSession() {
    setSessionBusy(true);
    setMessage("");
    try {
      if (mode === "account") {
        const result = await auth.signOut();
        if (result.error) throw new Error();
        window.location.assign("/account");
      } else {
        const result = await auth.signIn.social({ provider: "github", callbackURL: "/account" });
        if (result.error) throw new Error();
      }
    } catch {
      setMessage("登入狀態未變更，請稍後重試。");
      setSessionBusy(false);
    }
  }

  async function loadRepos() {
    if (repoPage === null || repoBusy) return;
    setRepoBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/repos?page=" + repoPage, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.repos) || !data.repos.every(isPublicRepo)) throw new Error();
      const updated = new Map(repos.map(repo => [repo.id, repo]));
      for (const repo of data.repos) updated.set(repo.id, repo);
      setRepos([...updated.values()]);
      setRepoPage(data.nextPage);
    } catch {
      setMessage("GitHub 暫時無法提供作品清單，請稍後重試。");
    } finally {
      setRepoBusy(false);
    }
  }

  function toggle(key: "skills" | "selectedRepos", value: string) {
    const values = profile[key];
    updateProfile({ [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] });
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/">← 返回職缺探索</Link>
      <h1>我的求職設定</h1>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <header><h2>我的技能</h2><span>{profile.skills.length} 項已選</span></header>
          <p>勾選你能在面試時用實例說明的技能。職缺推薦會依這份清單比對必備與加分條件。</p>
          <div className={styles.skills}>
            {SKILLS.map(skill => <button key={skill.id} type="button" disabled={!ready} aria-pressed={profile.skills.includes(skill.id)} onClick={() => toggle("skills", skill.id)}>{skill.label}</button>)}
          </div>
          <Link className={styles.textLink} href="/">查看符合我技能的職缺 →</Link>
        </section>
        <section className={styles.panel}>
          <header><h2>帳號</h2></header>
          {mode === "loading" ? <p>正在讀取設定…</p> : mode === "account"
            ? <p><strong>{name}</strong><br />技能、收藏與投遞紀錄儲存在這個帳號。</p>
            : <p>技能、收藏與投遞紀錄儲存在這個瀏覽器。{loginAvailable ? "登入後可以跨裝置使用帳號設定。" : "這個環境尚未啟用 GitHub 登入。"}</p>}
          {(mode === "account" || loginAvailable) && <button type="button" className={styles.action} disabled={sessionBusy || !ready} onClick={toggleSession}>{sessionBusy ? "處理中…" : mode === "account" ? "登出" : "使用 GitHub 登入"}</button>}
          <div className={styles.counts}><span>已收藏 <b>{profile.favorites.length}</b></span><span>已投遞 <b>{profile.applied.length}</b></span></div>
        </section>
      </div>
      <section className={styles.panel}>
        <header><h2>履歷使用的 GitHub 作品</h2><span>{profile.selectedRepos.length} 個已選</span></header>
        {mode === "account" ? <>
          <p>從自己公開的 repositories 勾選要引用的作品，產生履歷時再確認送出的資料。</p>
          {profile.selectedRepos.filter(fullName => !repos.some(repo => repo.fullName === fullName)).map(fullName =>
            <label key={fullName} className={styles.repo}><input type="checkbox" checked disabled={!ready} onChange={() => toggle("selectedRepos", fullName)} /><b>{fullName}</b></label>)}
          {repos.map(repo => <label key={repo.id} className={styles.repo}>
            <input type="checkbox" checked={profile.selectedRepos.includes(repo.fullName)} disabled={!ready} onChange={() => toggle("selectedRepos", repo.fullName)} />
            <span><b>{repo.fullName}</b>{repo.description && <small>{repo.description}</small>}</span>
            {repo.language && <em>{repo.language}</em>}
          </label>)}
          {repoPage !== null
            ? <button type="button" className={styles.action} disabled={repoBusy} onClick={loadRepos}>{repoBusy ? "讀取中…" : repoPage === 1 ? "讀取公開作品" : "載入更多作品"}</button>
            : repos.length === 0 && <p>GitHub 沒有回傳公開作品。</p>}
        </> : <p>登入 GitHub 後可以選取公開作品。你也可以直接在履歷編輯器填寫專案經歷。</p>}
        <Link className={styles.textLink} href="/resume">開啟履歷編輯器 →</Link>
      </section>
      {(message || error) && <p role="alert" className={styles.notice}>{message || error}</p>}
    </main>
  );
}
