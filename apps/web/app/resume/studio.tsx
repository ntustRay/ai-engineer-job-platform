'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { formatSections, JOB_LIMIT, makeMaterials, MATERIAL_LIMIT, redactContacts } from './materials';
import type { ResumeSection } from './materials';

type JobContext = { title: string; company: string; description: string };
type StudioProps = { accountStatus: 'authenticated' | 'anonymous' | 'unavailable'; missingJob: boolean; initialJob: JobContext | null };
type PublicRepo = { fullName: string };

function PrintBody({ draft }: { draft: string }) {
  return <div className="rs-print-body">{draft.split('\n').map((line, i) => {
    const value = line.trim();
    if (!value) return null;
    if (/^#{1,3}\s+/.test(value)) return <h3 key={i}>{value.replace(/^#{1,3}\s+/, '')}</h3>;
    return <p key={i} className={/^[-*]\s/.test(value) ? 'rs-bullet' : undefined}>{value.replace(/^[-*]\s+/, '')}</p>;
  })}</div>;
}

function Outgoing({ job, materials }: { job: string; materials: ReturnType<typeof makeMaterials> }) {
  return <details className="rs-outgoing">
    <summary>預覽將傳給模型的內容（{materials.length} 段素材）</summary>
    <strong>職缺描述</strong><p>{job || '請先提供目標職缺。'}</p>
    {materials.map((m) => <div key={m.id}><strong>{m.id}</strong><p>{m.text}</p></div>)}
  </details>;
}

export default function ResumeStudio({ accountStatus, initialJob, missingJob }: StudioProps) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob ? [initialJob.title, initialJob.company, initialJob.description].join('\n') : '');
  const [resume, setResume] = useState('');
  const [projects, setProjects] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [draft, setDraft] = useState('');
  const [references, setReferences] = useState<{ sections: ResumeSection[]; materials: ReturnType<typeof makeMaterials> } | null>(null);
  const [model, setModel] = useState('openrouter/free');
  const [repos, setRepos] = useState<PublicRepo[]>([]);
  const [savedRepos, setSavedRepos] = useState<string[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [repoName, setRepoName] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [repoMessage, setRepoMessage] = useState('');
  const keyInput = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLTextAreaElement>(null);
  const authenticated = accountStatus === 'authenticated';
  const materials = makeMaterials(resume, projects);
  const outgoingJob = redactContacts(job.trim());
  const evidenceLength = materials.reduce((n, m) => n + m.text.length, 0);
  const tooLarge = evidenceLength > MATERIAL_LIMIT || materials.length > 120 || outgoingJob.length > JOB_LIMIT;
  const pending = Boolean(busy);

  useEffect(() => {
    if (!authenticated) return;
    const ctrl = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/profile/repos', { cache: 'no-store', signal: ctrl.signal });
        if (!response.ok) throw new Error();
        const data: { repos: PublicRepo[]; nextPage: number | null } = await response.json();
        setRepos(data.repos);
        setNextPage(data.nextPage);
      } catch {
        if (!ctrl.signal.aborted) setRepoMessage('目前無法載入專案清單，可手動貼上作品摘要。');
      }
    })();
    void fetch('/api/profile', { cache: 'no-store', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const { profile }: { profile: { selectedRepos: string[] } } = await r.json();
        setSavedRepos(profile.selectedRepos);
      }).catch(() => {});
    return () => ctrl.abort();
  }, [authenticated]);

  async function moreRepos() {
    if (nextPage === null) return;
    setBusy('repo'); setRepoMessage('');
    try {
      const response = await fetch('/api/profile/repos?page=' + nextPage, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data: { repos: PublicRepo[]; nextPage: number | null } = await response.json();
      setRepos((current) => [...current, ...data.repos]); setNextPage(data.nextPage);
    } catch { setRepoMessage('目前無法取得下一頁專案。'); }
    finally { setBusy(''); }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy('file'); setMessage('');
    try {
      const { importDocument } = await import('./import-document');
      const imported = await importDocument(file);
      setResume((current) => [current.trim(), imported].filter(Boolean).join('\n\n'));
      setMessage(`已將「${file.name}」的文字加入經歷，請核對內容與排版。`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setMessage(/[\u3400-\u9fff]/.test(detail) ? detail : '無法讀取檔案。請確認文件未加密，或改用貼上文字。');
    } finally { setBusy(''); }
  }

  async function addRepo() {
    setBusy('repo'); setRepoMessage('');
    try {
      const response = await fetch('/api/resume/repository?name=' + encodeURIComponent(repoName), { cache: 'no-store' });
      const data: { evidence?: string; error?: string } = await response.json();
      if (!response.ok || !data.evidence) throw new Error(data.error || '無法讀取專案。');
      const evidence = data.evidence;
      setProjects((current) => [current.trim(), evidence].filter(Boolean).join('\n\n'));
      setRepoMessage('作品資料已加入，請保留你能說明的個人貢獻。');
    } catch (error) { setRepoMessage(error instanceof Error ? error.message : '讀取專案失敗。'); }
    finally { setBusy(''); }
  }

  function manualDraft() {
    if (draft.trim() && !window.confirm('要用目前的素材取代已編輯的草稿嗎？')) return;
    setReferences(null);
    setDraft([resume.trim() && '## 經歷與技能\n' + resume.trim(), projects.trim() && '## 作品\n' + projects.trim()].filter(Boolean).join('\n\n'));
    setMessage('已建立本機草稿，可在右方編輯。');
    output.current?.focus();
  }

  async function generate() {
    const key = keyInput.current?.value.trim();
    if (!key) { setMessage('請輸入自己的 OpenRouter API key。'); keyInput.current?.focus(); return; }
    if (draft.trim() && !window.confirm('生成成功後會取代目前草稿，確定繼續嗎？')) return;
    if (keyInput.current) keyInput.current.value = '';
    setBusy('model'); setMessage('正在根據已選素材改寫履歷…');
    try {
      const response = await fetch('/api/resume/generate', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model.trim(), key, job: outgoingJob, materials }),
      });
      const data: { sections?: ResumeSection[]; error?: string } = await response.json();
      if (!response.ok || !data.sections) throw new Error(data.error || '模型服務未回傳可使用的履歷。');
      setDraft(formatSections(data.sections)); setReferences({ sections: data.sections, materials });
      setMessage('AI 初稿已完成，請核對素材引用與內容後匯出。');
      output.current?.focus();
    } catch (error) { setMessage(error instanceof Error ? error.message : '呼叫模型時發生錯誤，請稍後再試。'); }
    finally { setBusy(''); }
  }

  return <main className="rs-studio">
    <header className="rs-intro">
      <a href="/">← 工作總覽</a>
      <h1>履歷工作室</h1>
      <p>為一份想投的工作，挑選相關經歷與作品，整理成可以直接寄出的履歷。</p>
    </header>
    <div className="rs-columns">
      <section className="rs-panel rs-inputs" aria-label="履歷素材">
        <h2>履歷素材</h2>
        <label htmlFor="rs-job">目標職缺</label>
        {missingJob && <p className="rs-note">這份職缺目前無法取得，仍可貼上職缺描述。</p>}
        <textarea id="rs-job" rows={4} value={job} onChange={(e) => setJob(e.target.value)} placeholder="貼上職稱、工作內容與應徵條件" />
        <div className="rs-label-row"><label htmlFor="rs-evidence">經歷與技能</label>
          <label className="rs-file" aria-disabled={pending}>匯入檔案<input aria-label="匯入履歷檔案" type="file" disabled={pending} accept=".txt,.md,.pdf,.docx" onChange={chooseFile}/></label>
        </div>
        <textarea id="rs-evidence" rows={6} value={resume} onChange={(e) => setResume(e.target.value)} placeholder="貼上履歷，或匯入 PDF、DOCX、TXT。用空白行分隔不同經歷。" />
        <p className="rs-note">{busy === 'file' ? '正在讀取檔案…' : '檔案在瀏覽器內讀取。姓名、電話、Email 可留到右側版面再填。'}</p>
        <label htmlFor="rs-projects">GitHub 作品與個人貢獻</label>
        {authenticated && <div className="rs-repos">
          <select aria-label="選擇自己的公開專案" value={repoName} onChange={(e) => setRepoName(e.target.value)}>
            <option value="">選擇公開 repo</option>
            {savedRepos.length > 0 && <optgroup label="帳號已選作品">{savedRepos.map((name) => <option key={name} value={name}>{name}</option>)}</optgroup>}
            <optgroup label="公開專案">{[...new Set(repos.map((r) => r.fullName))].filter((name) => !savedRepos.includes(name)).map((name) => <option key={name} value={name}>{name}</option>)}</optgroup>
          </select>
          <button disabled={pending || !repoName} onClick={addRepo}>加入作品</button>
        </div>}
        {authenticated && nextPage !== null && <button disabled={pending} onClick={moreRepos}>載入更多專案</button>}
        {repoMessage && <p role="status" className="rs-note">{repoMessage}</p>}
        <textarea id="rs-projects" rows={4} value={projects} onChange={(e) => setProjects(e.target.value)} placeholder="貼上作品連結與 README 重點，再補上你實際負責的部分" />
        <button className="rs-secondary" disabled={pending || !materials.length} onClick={manualDraft}>用素材建立草稿</button>
        <div className="rs-ai">
          <h2>針對職缺改寫</h2>
          {authenticated ? <>
            <p className="rs-note">按下生成後，列出的內容會傳至 OpenRouter。模型費用依你的帳戶與選擇的模型計算。</p>
            <Outgoing job={outgoingJob} materials={materials}/>
            <label htmlFor="rs-model">OpenRouter 模型</label>
            <input id="rs-model" value={model} placeholder="openrouter/free" onChange={(e) => setModel(e.target.value)} />
            <label htmlFor="rs-key">本次使用的 API key</label>
            <input id="rs-key" ref={keyInput} type="password" autoComplete="off" spellCheck={false} placeholder="sk-or-…" />
            {tooLarge && <p className="rs-warning">請縮短為 {MATERIAL_LIMIT.toLocaleString()} 字／120 段內的素材與 {JOB_LIMIT.toLocaleString()} 字內的職缺描述。</p>}
            <button className="rs-primary" onClick={generate} disabled={!outgoingJob || !materials.length || !model.trim() || pending || tooLarge}>{busy === 'model' ? '正在生成…' : '傳送素材並生成履歷'}</button>
          </> : <p>{accountStatus === 'unavailable' ? '目前無法使用 GitHub 登入，可先手動編輯與匯出。' : <><a href="/account" target="_blank" rel="noreferrer">在新分頁登入 GitHub</a> 後回到此頁，按 <button onClick={() => router.refresh()}>更新登入狀態</button> 即可用自己的 OpenRouter 額度改寫。</>}</p>}
        </div>
        {message && <p className="rs-status" role="status">{message}</p>}
      </section>
      <section className="rs-panel rs-preview" aria-label="履歷版面">
        <div className="rs-preview-head"><h2>履歷版面</h2><button className="rs-primary" onClick={() => window.print()} disabled={!draft.trim()}>列印 / 存為 PDF</button></div>
        <label htmlFor="rs-name">姓名</label><input id="rs-name" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="顯示在履歷上的姓名" />
        <label htmlFor="rs-contact">聯絡方式</label><input id="rs-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email、電話或個人網站" />
        <label htmlFor="rs-draft">可編輯草稿</label>
        <textarea id="rs-draft" ref={output} rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={'## 專業摘要\n\n## 工作經歷\n\n## 作品與技能'} />
        <p className="rs-note">以「## 」開頭可建立段落標題。姓名與聯絡欄位只用於本機排版；關閉頁面前請匯出。</p>
        {references && <details className="rs-outgoing"><summary>核對 AI 初稿引用</summary>
          {references.sections.flatMap((section) => section.bullets.map((b, i) => <div key={section.heading + ':' + i}>
            <strong>{b.text}</strong>
            {b.sources.map((id) => <p key={id}>{id} · {references.materials.find((m) => m.id === id)?.text}</p>)}
          </div>))}
        </details>}
        {draft.trim() && <article className="rs-sheet"><h2>{name.trim() || '個人履歷'}</h2>{contact && <p className="rs-contact-line">{contact}</p>}<PrintBody draft={draft} /></article>}
      </section>
    </div>
  </main>;
}
