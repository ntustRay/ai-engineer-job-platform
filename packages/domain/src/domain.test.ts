import { describe, expect, test } from "bun:test";
import { analyzeJob, classifyRole, matchJob, normalizeText, skillGains, type Job } from "./index";

const base = {
  source: "test", sourceId: "1", title: "前端工程師", company: "測試", location: "台北",
  url: "https://example.com/jobs/1", updatedAt: null, expiresAt: null,
};

function job(id: string, description: string): Job {
  return { ...base, id, description, ...analyzeJob(base.title, description) };
}

describe("job requirements", () => {
  test("separates alternatives, automated testing and optional Kubernetes", () => {
    const listing = job("a", "熟悉 React 或 Vue 其一，具備自動化測試經驗，使用過 Kubernetes 尤佳。");
    expect(listing.requirements.map(({ kind, skillIds }) => [kind, skillIds])).toEqual([
      ["required", ["react", "vue"]], ["required", ["automated-testing"]], ["preferred", ["kubernetes"]],
    ]);
    const result = matchJob(listing, ["vue", "vitest"]);
    expect(result.meetsKnownRequirements).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.matched[0].evidence).toContain("React 或 Vue");
  });

  test("inherits headings in HTML; repeated evidence counts once", () => {
    const listing = job("b", "<p>Requirements:</p><li>TypeScript</li><li>React, Vue, or Angular</li><p>加分條件：K8s</p><p>工作內容：</p><p>維護 Kubernetes 服務</p>");
    expect(listing.requirements.map(({ kind, skillIds }) => [kind, skillIds])).toEqual([
      ["required", ["typescript"]], ["required", ["react", "vue", "angular"]], ["preferred", ["kubernetes"]],
    ]);
  });

  test("skill mentions and negated qualifications do not establish eligibility", () => {
    const listing = job("c", "和使用 Node.js 的團隊協作。不要求 AWS 經驗。");
    expect(listing.requirements).toHaveLength(1);
    expect(listing.requirements[0].skillIds).toEqual(["nodejs"]);
    expect(matchJob(listing, ["nodejs"]).meetsKnownRequirements).toBe(false);
  });

  test("preferred headings scope familiarity cues and unrelated enumerations stay independent", () => {
    const listing = job("e", "Requirements: React, Vue and Python or Java.\n加分條件：熟悉 Kubernetes。");
    expect(listing.requirements.map(({ kind, skillIds }) => [kind, skillIds])).toEqual([
      ["required", ["react"]], ["required", ["vue"]], ["required", ["python", "java"]], ["preferred", ["kubernetes"]],
    ]);
  });

  test("supported aliases match mixed Chinese and English, without substrings", () => {
    const listing = job("d", "必須熟悉JavaScript、Next.js 與 RAG，不要求Java。Go beyond expectations。");
    expect(listing.requirements.flatMap((group) => group.skillIds)).toEqual(["javascript", "nextjs", "rag"]);
    expect(normalizeText("ＡＷＳ<br>Docker")).toBe("AWS\nDocker");
  });

  test("skill gains identify actual jobs, deduplicated, with no multiple-gap promises", () => {
    const a = job("a", "必備條件：React 或 Vue、CI/CD。");
    const b = job("b", "必備條件：Docker 和 K8s。");
    expect(skillGains([a, a, b], ["react"])).toEqual([{ skillId: "cicd", jobIds: ["a"] }]);
    expect(skillGains([job("c", "必備條件：React 或 Vue")], []).map((gain) => gain.skillId)).toEqual(["react", "vue"]);
  });

  test("preserves specific role from title; tech in description does not override role", () => {
    expect(classifyRole("前端開發工程師 – AI 產品")).toBe("frontend");
    expect(classifyRole("專案助理", "與 DevOps 團隊合作")).toBe("other");
    expect(classifyRole("Site Reliability Engineer")).toBe("devops");
  });

  test("refines broad engineering titles with explicit duties in the imported job", () => {
    expect(analyzeJob("軟體工程師", "主要負責網站前端開發與維護，建立共用元件。熟悉 TypeScript。").role).toBe("frontend");
    expect(classifyRole("程式設計師", "開發前端元件；維護後端服務。")).toBe("fullstack");
    expect(classifyRole("Senior Engineer", "Build data pipelines for business teams.")).toBe("data");
    expect(classifyRole("後端工程師", "協助維護前端頁面。")).toBe("backend");
  });

  test("tools, optional qualifications and incidental IT duties do not establish specialization", () => {
    expect(classifyRole("資訊服務處 B600 工程師", "排除使用者電腦問題，維護網路設備與雲端環境 (AWS)。")).toBe("other");
    expect(classifyRole("軟體工程師", "熟悉 React、AWS。前端開發經驗尤佳。")).toBe("software");
    expect(classifyRole("AI 產品行銷專員", "與工程團隊合作開發前端元件，熟悉 React。")).toBe("other");
    expect(classifyRole("產品助理", "為部門發展軟體介紹，React 元件展示。")).toBe("other");
  });
});
