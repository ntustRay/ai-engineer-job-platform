"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROLE_LABELS, SKILLS, matchJob, skillGains, type Job } from "@job/domain";
import { useAccountProfile } from "../lib/account-profile";
import type { MarketData } from "../lib/market-types";
import { Icon } from "./icons";
import { JobCard } from "./JobCard";
import { JobDetail } from "./JobDetail";
import { Trends } from "./Trends";
import { cityOf, dateLabel, frequency, jobSkills, searchableText, skillLabel } from "./market-display";

type Tab = "jobs" | "trends" | "skills";
type List = "all" | "today" | "saved" | "applied";

export function Workspace({ view, market }: { view: Tab; market: MarketData }) {
  const { profile, updateProfile, ready, mode, error } = useAccountProfile();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [skill, setSkill] = useState("");
  const [list, setList] = useState<List>("all");
  const [order, setOrder] = useState("recommended");
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<{ job: Job; archived: boolean } | null>(null);
  const [skillQuery, setSkillQuery] = useState("");
  const [gainSkill, setGainSkill] = useState("");
  const locations = useMemo(
    () => [...new Set(market.jobs.map((job) => cityOf(job.location)))].sort(),
    [market.jobs],
  );
  const roles = useMemo(() => [...new Set(market.jobs.map((job) => job.role))], [market.jobs]);
  const rankedSkills = useMemo(() => frequency(market.jobs), [market.jobs]);
  const scoped = useMemo(
    () =>
      market.jobs.filter((job) => (!role || job.role === role) && (!city || cityOf(job.location) === city)),
    [market.jobs, role, city],
  );
  const query = search.trim().toLowerCase().replaceAll("臺", "台");
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todaysJobs = useMemo(
    () =>
      new Set(
        market.jobs
          .filter(
            (job) =>
              market.coverage.mode === "database" &&
              market.firstSeen[job.id] === today &&
              !profile.applied.includes(job.id),
          )
          .map((j) => j.id),
      ),
    [market, today, profile.applied],
  );
  const jobs = useMemo(() => {
    const matches = scoped.filter(
      (job) =>
        (!query || searchableText(job).includes(query)) &&
        (!skill || jobSkills(job).includes(skill)) &&
        (list === "all" ||
          (list === "today"
            ? todaysJobs.has(job.id)
            : (list === "saved" ? profile.favorites : profile.applied).includes(job.id))),
    );
    const scores = new Map(matches.map((job) => [job.id, matchJob(job, profile.skills).score]));
    return matches.sort((a, b) => {
      if (order === "recommended" && profile.skills.length) {
        const difference = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        if (difference) return difference;
      }
      const observed =
        order === "recommended" && market.coverage.mode === "database"
          ? (market.firstSeen[b.id] || "").localeCompare(market.firstSeen[a.id] || "")
          : 0;
      return (
        observed ||
        (b.updatedAt || "").localeCompare(a.updatedAt || "") ||
        a.title.localeCompare(b.title, "zh-TW")
      );
    });
  }, [
    scoped,
    query,
    skill,
    list,
    todaysJobs,
    market.firstSeen,
    market.coverage.mode,
    profile.favorites,
    profile.applied,
    profile.skills,
    order,
  ]);
  const gains = useMemo(() => skillGains(scoped, profile.skills), [scoped, profile.skills]);
  const selectedGain = gains.find((g) => g.skillId === gainSkill);
  const categories = useMemo(() => [...new Set(SKILLS.map((s) => s.category))], []);
  function toggle(bucket: "skills" | "favorites" | "applied", value: string) {
    const values = profile[bucket];
    void updateProfile({
      [bucket]: values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
    });
  }
  function resetFilters() {
    setSearch("");
    setSkill("");
    setRole("");
    setCity("");
    setList("all");
    setLimit(12);
  }
  function openJob(job: Job, archived = false) {
    setSelected({ job, archived });
  }
  const hasFilters = !!(search || role || city || skill || list !== "all");
  const companyCount = new Set(market.jobs.map((job) => job.company).filter(Boolean)).size;
  const scopePicker = (
    <>
      <label>
        職位
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setLimit(12);
          }}
        >
          <option value="">所有職位</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label>
        地點
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setLimit(12);
          }}
        >
          <option value="">所有地區</option>
          {locations.map((loc) => (
            <option key={loc}>{loc}</option>
          ))}
        </select>
      </label>
    </>
  );
  return (
    <main className="atlas-main">
      {view === "jobs" ? (
        <section className="atlas-hero" aria-labelledby="atlas-title">
          <div className="atlas-hero-main">
            <span className="atlas-source-label">
              <i /> {market.coverage.mode === "snapshot" ? "公開職缺快照" : "職缺觀測資料"}{" "}
              <span>{dateLabel(market.coverage.updatedAt)}</span>
            </span>
            <h1 id="atlas-title">工程師職缺探索</h1>
            <div className="atlas-hero-stats">
              <span>
                <b>{market.jobs.length.toLocaleString()}</b> 筆職缺
              </span>
              <span>
                <b>{companyCount.toLocaleString()}</b> 家公司
              </span>
              <span>
                <b>{rankedSkills.length}</b> 項技能
              </span>
            </div>
          </div>
          <div className="atlas-hero-chart">
            <h2>
              <Icon name="chart" size={17} />
              職缺最常提及的技能
            </h2>
            {rankedSkills.length ? (
              rankedSkills.slice(0, 3).map(([id, n]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={skill === id}
                  title={`篩選提及 ${skillLabel(id)} 的職缺`}
                  onClick={() => {
                    resetFilters();
                    setSkill(skill === id ? "" : id);
                  }}
                >
                  <span>{skillLabel(id)}</span>
                  <i>
                    <b style={{ width: `${(100 * n) / (rankedSkills[0]?.[1] || 1)}%` }} />
                  </i>
                  <small>{n} 筆</small>
                </button>
              ))
            ) : (
              <p>尚無技能觀測資料</p>
            )}
          </div>
        </section>
      ) : (
        <div className="atlas-page-heading">
          <span className="atlas-page-flourish" />
          <h1>{view === "trends" ? "市場技能趨勢" : "我的技能"}</h1>
          <p>
            {view === "trends"
              ? "從職位與技能的交集，查看需求變化和對應職缺。"
              : "選擇你有實作經驗的技能，查看符合的職缺與下一步學習方向。"}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="atlas-note">
          {error}
        </p>
      )}
      {view === "trends" && <Trends market={market} onOpen={openJob} />}
      {view === "jobs" && (
        <div className="atlas-columns">
          <section aria-label="搜尋與職缺清單" className="atlas-results">
            <div className="atlas-section-head">
              <h2>
                <Icon name="briefcase" size={21} />
                職缺清單
              </h2>
              <label className="atlas-order">
                <span>排序</span>
                <select value={order} onChange={(e) => setOrder(e.target.value)}>
                  <option value="recommended">推薦優先</option>
                  <option value="date">最近更新</option>
                </select>
              </label>
            </div>
            <div className="atlas-filter-box">
              <label className="atlas-search">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="搜尋職稱、公司或技能"
                  placeholder="搜尋職稱、公司或技能"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(12);
                  }}
                />
              </label>
              <div className="atlas-filters">
                {scopePicker}
                <label>
                  技能
                  <select
                    value={skill}
                    onChange={(e) => {
                      setSkill(e.target.value);
                      setLimit(12);
                    }}
                  >
                    <option value="">所有技能</option>
                    {rankedSkills.map(([id]) => (
                      <option key={id} value={id}>
                        {skillLabel(id)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="atlas-list-tabs">
              {(
                [
                  ["all", "全部職缺"],
                  [
                    "today",
                    market.coverage.mode === "database" ? `今日新收錄 ${todaysJobs.size}` : "今日新收錄",
                  ],
                  ["saved", "已收藏"],
                  ["applied", "已投遞"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={list === key}
                  onClick={() => {
                    setList(key);
                    setLimit(12);
                  }}
                >
                  {label}
                </button>
              ))}
              <small aria-live="polite">{jobs.length} 筆</small>
            </div>
            <div className="atlas-job-list">
              {jobs.slice(0, limit).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  skills={profile.skills}
                  ready={ready}
                  favorite={profile.favorites.includes(job.id)}
                  applied={profile.applied.includes(job.id)}
                  firstSeen={market.coverage.mode === "database" ? market.firstSeen[job.id] || null : null}
                  onOpen={openJob}
                  onFavorite={() => toggle("favorites", job.id)}
                />
              ))}
            </div>
            {jobs.length === 0 && (
              <div className="atlas-empty">
                <Icon name="search" size={28} />
                <h3>
                  {list === "today"
                    ? market.coverage.mode === "snapshot"
                      ? "快照無法判斷今日新增"
                      : "目前條件下沒有今日新收錄的職缺"
                    : list === "saved"
                      ? "此範圍內沒有已收藏職缺"
                      : list === "applied"
                        ? "此範圍內沒有投遞紀錄"
                        : "目前沒有符合條件的職缺"}
                </h3>
                <p>
                  {list === "today"
                    ? "每日同步後，這裡會顯示台灣時間今天首次觀測且你尚未投遞的工作。"
                    : list === "saved"
                      ? "職缺右上角的書籤可以保存想回來看的工作。"
                      : list === "applied"
                        ? "開啟職缺內容後，可手動標記已投遞。"
                        : "調整搜尋字詞或篩選條件，查看其他機會。"}
                </p>
                {hasFilters && (
                  <button type="button" className="atlas-secondary" onClick={resetFilters}>
                    顯示全部職缺
                  </button>
                )}
              </div>
            )}
            {jobs.length > limit && (
              <button type="button" className="atlas-more" onClick={() => setLimit(limit + 12)}>
                顯示更多職缺（還有 {jobs.length - limit} 筆）
              </button>
            )}
          </section>
          <aside className="atlas-rail">
            <section className="atlas-profile-panel">
              <div className="atlas-side-icon">
                <Icon name="sliders" size={21} />
              </div>
              <h2>我的技能</h2>
              {profile.skills.length ? (
                <div className="atlas-tags">
                  {profile.skills.slice(0, 6).map((id) => (
                    <span className="atlas-tag atlas-tag-owned" key={id}>
                      {skillLabel(id)}
                    </span>
                  ))}
                  {profile.skills.length > 6 && (
                    <span className="atlas-tag">+{profile.skills.length - 6}</span>
                  )}
                </div>
              ) : (
                <p>選擇你會的技術，比對每份職缺的必備條件。</p>
              )}
              <Link className="atlas-primary" href="/?view=skills">
                {profile.skills.length ? "調整技能" : "選擇我的技能"}
                <Icon name="arrow" size={16} />
              </Link>
            </section>
            <Coverage market={market} />
            <Link href="/research" className="atlas-research-link">
              <span>
                <Icon name="chart" size={18} />
                官方歷年調查
              </span>
              <Icon name="chevron" size={16} />
            </Link>
          </aside>
        </div>
      )}
      {view === "skills" && (
        <div className="atlas-columns">
          <section className="atlas-panel">
            <div className="atlas-section-head">
              <h2>技能清單</h2>
              <span className="atlas-count">已選 {profile.skills.length} 項</span>
            </div>
            <label className="atlas-search">
              <Icon name="search" />
              <input
                type="search"
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                aria-label="搜尋技能"
                placeholder="搜尋技能"
              />
            </label>
            {categories.map((category) => {
              const options = SKILLS.filter(
                (s) =>
                  s.category === category &&
                  s.label.toLowerCase().includes(skillQuery.trim().toLowerCase()),
              );
              return (
                options.length > 0 && (
                  <fieldset className="atlas-skill-group" key={category}>
                    <legend>{category}</legend>
                    <div className="atlas-skill-options">
                      {options.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!ready}
                          aria-pressed={profile.skills.includes(s.id)}
                          onClick={() => toggle("skills", s.id)}
                        >
                          <Icon name={profile.skills.includes(s.id) ? "check" : "plus"} size={13} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )
              );
            })}
            {skillQuery &&
              !SKILLS.some((s) => s.label.toLowerCase().includes(skillQuery.trim().toLowerCase())) && (
                <p className="atlas-note">技能字典目前沒有這個項目。</p>
              )}
            <p className="atlas-footnote">
              {mode === "account"
                ? "已連結帳號，技能可跨裝置使用。"
                : "技能儲存在這台裝置。登入後可跨裝置使用。"}
            </p>
          </section>
          <aside className="atlas-rail">
            <section className="atlas-profile-panel">
              <div className="atlas-side-icon">
                <Icon name="layers" size={21} />
              </div>
              <h2>補一項技能的機會</h2>
              <p>在目前職缺中，只差一項已辨識必備條件的工作。</p>
              <div className="atlas-filters atlas-small-filters">{scopePicker}</div>
              {gains.length ? (
                <div className="atlas-gain-list">
                  {gains.slice(0, 6).map((g) => (
                    <button
                      type="button"
                      key={g.skillId}
                      aria-expanded={gainSkill === g.skillId}
                      onClick={() => setGainSkill(gainSkill === g.skillId ? "" : g.skillId)}
                    >
                      <span>{skillLabel(g.skillId)}</span>
                      <strong>+{g.jobIds.length} 筆</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="atlas-note">目前範圍沒有只差一項技能的職缺。</p>
              )}
              {selectedGain && (
                <ul className="atlas-gain-jobs">
                  {scoped
                    .filter((j) => selectedGain.jobIds.includes(j.id))
                    .map((j) => (
                      <li key={j.id}>
                        <button type="button" onClick={() => openJob(j)}>
                          {j.title}
                          <small>{j.company}</small>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
              <Link className="atlas-primary" href="/">
                查看職缺推薦
                <Icon name="arrow" size={16} />
              </Link>
            </section>
          </aside>
        </div>
      )}
      {selected && (
        <JobDetail
          job={selected.job}
          archived={selected.archived}
          skills={profile.skills}
          applied={profile.applied.includes(selected.job.id)}
          ready={ready}
          onApply={() => toggle("applied", selected.job.id)}
          onDismiss={() => setSelected(null)}
        />
      )}
    </main>
  );
}

export function Coverage({ market }: { market: MarketData }) {
  const c = market.coverage;
  return (
    <section className="atlas-source-panel">
      <h2>資料涵蓋</h2>
      <dl>
        <div>
          <dt>來源</dt>
          <dd>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
              {c.source}
              <Icon name="external" size={12} />
            </a>
          </dd>
        </div>
        <div>
          <dt>更新日期</dt>
          <dd>{dateLabel(c.updatedAt)}</dd>
        </div>
      </dl>
      {c.note && <p>{c.note}</p>}
    </section>
  );
}
