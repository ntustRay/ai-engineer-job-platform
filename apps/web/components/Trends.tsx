"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ROLE_LABELS, SKILLS, type Job, type RoleId, type RequirementKind } from "@job/domain";
import type { MarketData, MarketHistory } from "../lib/market-types";
import { Icon } from "./icons";
import { cityOf, frequency, KIND_LABELS, skillLabel } from "./market-display";

const TrendChart = dynamic(() => import("./TrendChart"), {
  ssr: false,
  loading: () => <div className="atlas-trend-canvas">載入趨勢圖…</div>,
});
type Selection = { role: RoleId | ""; skill: string };
type FetchState = { key: string; result: MarketHistory | null; error: boolean };
const allRoles = Object.entries(ROLE_LABELS);

export function Trends({
  market,
  onOpen,
}: {
  market: MarketData;
  onOpen: (job: Job, archived?: boolean) => void;
}) {
  const [city, setCity] = useState("");
  const [kind, setKind] = useState<RequirementKind | "">("");
  const [selection, setSelection] = useState<Selection>(() => ({
    role: "",
    skill: frequency(market.jobs)[0]?.[0] || "react",
  }));
  const [period, setPeriod] = useState("");
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<FetchState>({ key: "", result: null, error: false });
  const cities = useMemo(
    () => [...new Set(market.jobs.map((job) => cityOf(job.location)))].sort(),
    [market.jobs],
  );
  const scoped = useMemo(
    () => market.jobs.filter((job) => !city || cityOf(job.location) === city),
    [market.jobs, city],
  );
  const topSkills = useMemo(
    () =>
      frequency(scoped, kind || undefined)
        .slice(0, 7)
        .map(([id]) => id),
    [scoped, kind],
  );
  const matrix = useMemo(
    () =>
      [...new Set(scoped.map((j) => j.role))]
        .map((role) => {
          const cohort = scoped.filter((j) => j.role === role);
          return { role, total: cohort.length, counts: new Map(frequency(cohort, kind || undefined)) };
        })
        .sort((a, b) => b.total - a.total),
    [scoped, kind],
  );
  const params = new URLSearchParams({ skill: selection.skill });
  if (selection.role) params.set("role", selection.role);
  if (city) params.set("location", city);
  if (kind) params.set("kind", kind);
  if (period) params.set("period", period);
  const url = `/api/market/history?${params.toString()}`;
  const result = response.key === url ? response.result : null;
  const failed = response.key === url && response.error;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(url, { signal: controller.signal, cache: retry ? "reload" : "default" });
        if (!res.ok) throw new Error("market-history");
        const result: MarketHistory = await res.json();
        if (!controller.signal.aborted) setResponse({ key: url, result, error: false });
      } catch {
        if (!controller.signal.aborted) setResponse({ key: url, result: null, error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [url, retry]);
  function select(role: RoleId | "", skill: string) {
    setSelection({ role, skill });
    setPeriod("");
  }
  return (
    <div className="atlas-trends">
      <section className="atlas-panel atlas-matrix-panel">
        <div className="atlas-section-head">
          <h2>
            <Icon name="layers" />
            職位與技能分布
          </h2>
          <span className="atlas-count">目前收錄 {scoped.length} 筆</span>
        </div>
        <div className="atlas-filters">
          <label>
            地點
            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPeriod("");
              }}
            >
              <option value="">所有地區</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            技能條件
            <select
              value={kind}
              onChange={(e) => {
                const k = e.target.value;
                setKind(k === "required" || k === "preferred" || k === "mentioned" ? k : "");
                setPeriod("");
              }}
            >
              <option value="">全部提及</option>
              {Object.entries(KIND_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {matrix.length && topSkills.length ? (
          <>
            <div className="atlas-table-scroll">
              <table className="atlas-matrix">
                <caption className="atlas-sr-only">
                  目前職缺中各職位的技能占比，點選儲存格查看各月觀測與職缺。
                </caption>
                <thead>
                  <tr>
                    <th scope="col">職位</th>
                    {topSkills.map((s) => (
                      <th scope="col" key={s}>
                        {skillLabel(s)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.role}>
                      <th scope="row">
                        {ROLE_LABELS[row.role]}
                        <small>{row.total} 筆</small>
                      </th>
                      {topSkills.map((s) => {
                        const n = row.counts.get(s) ?? 0;
                        const percent = Math.round((100 * n) / row.total);
                        return (
                          <td key={s}>
                            <button
                              className={`atlas-cell atlas-heat-${n ? Math.ceil((n / row.total) * 4) : 0}`}
                              type="button"
                              aria-pressed={selection.role === row.role && selection.skill === s}
                              aria-label={`${ROLE_LABELS[row.role]}，${skillLabel(s)}，${n} / ${row.total} 筆，${percent}%`}
                              onClick={() => select(row.role, s)}
                            >
                              {percent}%
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="atlas-matrix-footer">
              <span>點選格子查看歷史月份與職缺依據。</span>
              <span className="atlas-palette">
                低 <i />
                <i />
                <i />
                <i /> 高
              </span>
            </div>
          </>
        ) : (
          <p className="atlas-note">目前範圍沒有可辨識的技能資料，可調整地點或條件。</p>
        )}
      </section>
      <div className="atlas-columns">
        <section className="atlas-panel">
          <div className="atlas-section-head">
            <h2>
              <Icon name="chart" />
              技能需求月度觀測
            </h2>
          </div>
          <div className="atlas-filters">
            <label>
              觀測職位
              <select
                value={selection.role}
                onChange={(e) => {
                  const role = Object.keys(ROLE_LABELS).find((r): r is RoleId => r === e.target.value);
                  select(role || "", selection.skill);
                }}
              >
                <option value="">所有職位</option>
                {allRoles.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              觀測技能
              <select value={selection.skill} onChange={(e) => select(selection.role, e.target.value)}>
                {SKILLS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div aria-live="polite">
            {failed ? (
              <p className="atlas-note">
                暫時無法載入觀測資料。{" "}
                <button type="button" className="atlas-text-btn" onClick={() => setRetry((n) => n + 1)}>
                  重試
                </button>
              </p>
            ) : !result ? (
              <p className="atlas-note">載入觀測資料中…</p>
            ) : (
              <>
                {result.comparable && result.points.length > 1 ? (
                  <TrendChart
                    points={result.points.filter((p) => result.comparablePeriods.includes(p.period))}
                  />
                ) : (
                  <p className="atlas-note">
                    {result.points.length
                      ? "可比較的完整月份尚不足，以下列出各期實際觀測值。"
                      : "這組條件尚無歷史觀測資料。"}
                  </p>
                )}
                {result.points.length > 0 && (
                  <div className="atlas-table-scroll">
                    <table className="atlas-periods">
                      <thead>
                        <tr>
                          <th>觀測月份</th>
                          <th>符合 / 樣本</th>
                          <th>占比</th>
                          <th>涵蓋</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.points.map((p) => (
                          <tr key={p.period}>
                            <td>
                              <button
                                type="button"
                                aria-pressed={period === p.period}
                                onClick={() => setPeriod(p.period)}
                              >
                                {p.period}
                              </button>
                            </td>
                            <td>
                              {p.matching} / {p.total}
                            </td>
                            <td>{p.total ? `${Math.round((100 * p.matching) / p.total)}%` : "—"}</td>
                            <td>
                              {p.observedDays} 天{!p.complete && "（部分）"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {period ? (
                  <div className="atlas-drill">
                    <h3>
                      {period} 職缺依據 <small>{result.evidenceTotal} 筆</small>
                    </h3>
                    {result.evidence.length ? (
                      <ul>
                        {result.evidence.map((j) => (
                          <li key={j.id}>
                            <button type="button" onClick={() => onOpen(j, true)}>
                              <span>
                                {j.title}
                                <small>{j.company}</small>
                              </span>
                              <Icon name="chevron" size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>當月沒有符合的職缺。</p>
                    )}
                    {result.evidenceTotal > result.evidence.length && (
                      <small>顯示前 {result.evidence.length} 筆。</small>
                    )}
                  </div>
                ) : (
                  result.points.length > 0 && (
                    <p className="atlas-footnote">點選月份以閱讀當期的職缺描述。</p>
                  )
                )}
              </>
            )}
          </div>
        </section>
        <aside className="atlas-rail">
          <section className="atlas-profile-panel">
            <div className="atlas-side-icon">
              <Icon name="calendar" />
            </div>
            <h2>官方歷年調查</h2>
            <p>查看政府統計如何描述各類 AI 職位的招募難易變化。</p>
            <Link className="atlas-primary" href="/research">
              瀏覽調查
              <Icon name="arrow" size={16} />
            </Link>
          </section>
          <section className="atlas-source-panel">
            <h2>如何讀這張圖</h2>
            <p>每個格子的分母是同一職位的去重職缺數。一份職缺即使多次提及某項技能，也只計一次。</p>
            <p>{market.coverage.note}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
