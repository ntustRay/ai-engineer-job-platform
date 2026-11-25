"use client";

import { analyzeJob, SKILLS } from "@job/domain";
import { useDeferredValue, useMemo, useState } from "react";
import { useAccountProfile } from "../../lib/account-profile";
import { redactContacts } from "./materials";

export function findSkillCandidates(resume: string, projects: string) {
  const found = new Map<string, { source: string; excerpt: string }>();
  for (const [source, text] of [["履歷", resume], ["作品", projects]]) {
    for (const requirement of analyzeJob("", redactContacts(text)).requirements) {
      for (const id of requirement.skillIds) {
        if (!found.has(id)) found.set(id, { source, excerpt: requirement.evidence });
      }
    }
  }
  return SKILLS.flatMap(({ id, label }) => {
    const evidence = found.get(id);
    return evidence ? [{ id, label, ...evidence }] : [];
  });
}

export default function ConfirmSkills({ resume, projects }: { resume: string; projects: string }) {
  const [open, setOpen] = useState(false);
  const deferredResume = useDeferredValue(resume);
  const deferredProjects = useDeferredValue(projects);
  const candidates = useMemo(
    () => open ? findSkillCandidates(deferredResume, deferredProjects) : [],
    [open, deferredResume, deferredProjects],
  );
  const { profile, ready, mode, updateProfile, error } = useAccountProfile();
  const isCurrent = resume === deferredResume && projects === deferredProjects;
  return <details className="rs-outgoing" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>從履歷與作品確認推薦技能</summary>
    <p>依自己的實際經驗逐項加入。推薦設定只儲存確認的技能名稱。</p>
    {candidates.length === 0
      ? <p>{resume.trim() || projects.trim() ? "素材中尚未找到可比對的技能。" : "先加入履歷文字或作品說明，即可在這裡確認技能。"}</p>
      : candidates.map(({ id, label, source, excerpt }) => {
          const included = profile.skills.includes(id);
          return <div key={id}>
            <p><b>{label}</b> · {source}<br />{excerpt}</p>
            <button type="button" disabled={!ready || !isCurrent || included} aria-label={included ? label + " 已在我的技能" : "加入 " + label}
              onClick={() => updateProfile({ skills: [...new Set([...profile.skills, id])] })}>
              {included ? "已在我的技能" : "加入我的技能"}
            </button>
          </div>;
        })}
    {error && <p role="alert">{error}</p>}
    {ready && <p>{mode === "account" ? "已確認的技能會同步至帳號。" : "已確認的技能儲存在這個瀏覽器。"} <a href="/" target="_blank" rel="noopener noreferrer">在新分頁查看推薦職缺 →</a></p>}
  </details>;
}
