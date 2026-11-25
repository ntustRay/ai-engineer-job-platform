import type { Job, Requirement, RequirementKind, RoleId } from "./model";
import { findSkills, type SkillHit } from "./skills";

export const RULES_VERSION = "2026-11-26.2";

export function normalizeText(value: string): string {
  return value.normalize("NFKC")
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<(?:br\s*\/?|\/(?:p|div|li|h[1-6]|tr))\s*>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").trim();
}

// A frontend engineer building an AI product keeps the explicitly named role.
const roles: [RoleId, RegExp][] = [
  ["fullstack", /全[端棧栈]|前後端|前[、/]後端|\bfull[\s-]?stack\b/i],
  ["frontend", /\bfront[\s-]?end\b|前端|網頁切版/i],
  ["backend", /\bback[\s-]?end\b|後端/i],
  ["security", /資安|資訊安全|網路安全|\b(?:cybersecurity|security engineer|appsec)\b/i],
  ["ai", /\b(?:AI|ML|LLM|machine learning|deep learning)\b|人工智慧|機器學習|深度學習|大[型語]*言模型/i],
  ["data", /\b(?:data (?:analyst|engineer|scientist|architect)|analytics engineer|ETL)\b|(?:數據|資料)(?:分析|工程|科學)|資料庫管理/i],
  ["devops", /\b(?:devops|devsecops|sre|site reliability|platform engineer|cloud engineer)\b|(?:雲端|維運|運維|平台)工程/i],
  ["qa", /\b(?:QA|SDET|test engineer|quality assurance|software tester)\b|軟體測試|測試自動化|自動化測試/i],
  ["design", /\b(?:product design(?:er)?|design engineer|UI\/UX|UX\/UI|UX designer|UI designer)\b|(?:產品|互動|介面|使用者體驗)設計/i],
  ["mobile", /\b(?:android|ios|mobile|flutter|react native)\b|(?:行動應用|行動軟體|手機應用)/i],
  ["software", /\b(?:software (?:developer|engineer)|web developer|programmer)\b|(?:軟體|軟件|程式|軟韌體)(?:開發|設計|工程)|程式設計師/i],
];

// Generic engineering titles can be refined by work performed. A tool name, team
// name or hiring requirement alone says too little about the person's occupation.
const technicalTitle = /(?:工程師|程式設計|開發人員|資訊人員|技術人員|\b(?:engineer|developer|programmer)\b)/i;
const nonEngineeringTitle = /專案(?:經理|助理)|(?:行政|業務|行銷|採購|人資|客服)(?:人員|助理|代表|專員|經理)|(?:產品經理|業務工程師)|\b(?:sales engineer|account executive|project manager|product manager|marketing specialist|technical recruiter)\b/i;
const qualificationOrCollaboration = /加分|尤佳|優先|熟悉|具備|相關經驗|團隊(?:合作|協作)|\b(?:experience with|familiar with|preferred|collaborate with)\b/i;
const responsibilities: [RoleId, RegExp][] = [
  ["frontend", /(?:開發|實作|維護|優化)(?:網站|網頁|產品|應用程式|既有|的|及|與|\s)*(?:前端(?:功能|介面|頁面|元件|組件)|響應式網頁)|(?:前端(?:頁面|元件|介面)?|前台頁面)(?:之|的|與|及|\s)*(?:開發|維護|實作)|\b(?:build|develop|implement|maintain)\s+(?:reusable\s+|responsive\s+)?(?:front[ -]?end components|web interfaces|react components)\b/i],
  ["backend", /(?:開發|設計|實作|維護)(?:並|與|及|開發|設計|服務端|後端|系統|的|\s)*(?:後端服務|REST(?:ful)?\s*API|GraphQL\s*API)|(?:後端(?:服務|\s*API)?|後台API)(?:的|之|\s)*(?:設計|開發|維護)|\b(?:build|develop|maintain)\s+(?:backend services|server-side applications|rest(?:ful)? apis)\b/i],
  ["devops", /(?:建置|建構|建立|設計|維護|優化)(?:及|與|維護|自動化|的|\s)*(?:CI\s*\/\s*CD\s*(?:流程|管線|pipeline)|自動化部署(?:流程|管線))|\b(?:build|maintain|implement)\s+(?:deployment pipelines|ci\/cd pipelines|infrastructure as code)\b/i],
  ["qa", /(?:撰寫|設計|建置|開發)(?:並|及|與|執行|\s)*(?:自動化測試(?:腳本|案例|框架)|軟體測試(?:案例|計畫))|\b(?:design|develop|maintain)\s+(?:automated test suites|test automation frameworks)\b/i],
  ["data", /(?:設計|開發|建置|維護)(?:及|與|開發|維護|\s)*(?:資料管線|數據管線|ETL\s*(?:流程|管線)|資料倉儲)|\b(?:build|maintain|develop)\s+(?:data pipelines|etl pipelines|data warehouses)\b/i],
  ["ai", /(?:開發|實作|建置)(?:及|與|維護|\s)*(?:RAG\s*(?:檢索系統|系統|流程)|LLM\s*(?:推論服務|評估流程)|機器學習模型)|\b(?:train|fine-tune|deploy)\s+(?:language models|machine learning models)\b/i],
];

export function classifyRole(title: string, description = ""): RoleId {
  const text = normalizeText(title);
  if (nonEngineeringTitle.test(text)) return "other";
  const fromTitle = roles.find(([, pattern]) => pattern.test(text))?.[0];
  if (fromTitle && fromTitle !== "software") return fromTitle;
  if (!technicalTitle.test(text) && !fromTitle) return "other";

  const duties = normalizeText(description).split(/[。；;!！?？,\n]|\.(?=\s)/)
    .filter(clause => !qualificationOrCollaboration.test(clause));
  const inferred = responsibilities.filter(([, pattern]) => duties.some(duty => pattern.test(duty)))
    .map(([role]) => role);
  if (inferred.length === 1) return inferred[0];
  if (inferred.length === 2 && inferred.includes("frontend") && inferred.includes("backend")) return "fullstack";
  return fromTitle ?? "other";
}

const preferred = /加分|尤佳|優先|更佳|為佳|者佳|佳者|額外優勢|\b(?:preferred|nice[\s-]to[\s-]have|bonus|a plus|desirable|is a plus)\b/i;
const required = /必[備須要修]|需要|需具|需有|須具|須有|熟[悉練]|精通|具備|擅長|精熟|至少[一1]|能夠|\b(?:required|requirements?|must[\s-]have|must|proficien(?:cy|t)|experience (?:with|in)|strong knowledge|familiar with)\b/i;
const negated = /(?:無[需須]|不(?:強制|需要|要求|須具備|需具備|必具有))|\b(?:not required|not necessary|no .{0,45} required)\b/i;
const contextHeading = /工作內容|職務內容|公司介紹|公司簡介|福利|職責|關於我們|薪資|(?:responsibilities|benefits|about (?:us|the (?:role|team)))/i;
const requiredHeading = /^(?:必備(?:條件|技能)?|資格(?:條件)?|職務條件|職缺條件|任職要求|能力要求|條件要求|(?:minimum |basic )?qualifications|(?:minimum |basic )?requirements|required skills|must[\s-]haves?)$/i;

function requirementKind(text: string): RequirementKind | null {
  if (preferred.test(text)) return "preferred";
  if (negated.test(text)) return "mentioned";
  if (required.test(text)) return "required";
  return null;
}

function headingKind(text: string): RequirementKind | null {
  const label = text.trim().replace(/^[#【[（(•\s]+|[】\]）):\s]+$/g, "");
  if (label.length > 45 || findSkills(label).length) return null;
  if (preferred.test(label)) return "preferred";
  if (requiredHeading.test(label)) return "required";
  if (contextHeading.test(label)) return "mentioned";
  return null;
}

function clauses(text: string): string[] {
  const result: string[] = [];
  let current = "";
  for (const part of text.split(",")) {
    // Keep enumerations and "React, Vue, or Angular" together.
    if (current && requirementKind(part) && findSkills(current).length) {
      result.push(current);
      current = "";
    }
    current = current ? current + "," + part : part;
  }
  if (current.trim()) result.push(current);
  return result;
}

function alternatives(text: string, hits: SkillHit[]): string[][] {
  const groups: string[][] = [];
  const choiceList = /(?:至少|任選|任|擇)[一1](?:種|項|個)?|\bone of\b|\beither\b/i.test(text);
  const orLink = /^(?:、?\s*或(?:者|是)?|[,、]?\s*or|\/|／)$/i;
  const listLink = /^[,、]$/;
  const connectors = hits.map((hit, index) =>
    index ? text.slice(hits[index - 1].end, hit.start).trim() : "");
  // Walk backward through contiguous enumerations so "A, B, or C" is one
  // group while "A, B and C or D" keeps A separate from B.
  const choiceLinks = new Set<number>();
  for (let i = hits.length - 1; i > 0; i--) {
    const connector = connectors[i];
    if (orLink.test(connector) || (listLink.test(connector) && (choiceList || choiceLinks.has(i + 1)))) {
      choiceLinks.add(i);
    }
  }
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (choiceLinks.has(i)) {
      const group = groups[groups.length - 1];
      if (!group.includes(hit.id)) group.push(hit.id);
    } else {
      groups.push([hit.id]);
    }
  }
  return groups;
}

export function analyzeJob(title: string, description: string): Pick<Job, "role" | "requirements"> {
  const byGroup = new Map<string, Requirement>();
  const priority = { mentioned: 0, preferred: 1, required: 2 };
  let section: RequirementKind = "mentioned";
  function record(text: string, defaultKind: RequirementKind) {
    const hits = findSkills(text);
    // "Experience with Kubernetes not required" is not evidence of a skill requirement.
    if (!hits.length || (negated.test(text) && !preferred.test(text))) return;
    // 「加分條件：熟悉 K8s」remains optional even though 熟悉 is a requirement cue.
    const kind = defaultKind === "preferred" ? defaultKind : requirementKind(text) ?? defaultKind;
    for (const skillIds of alternatives(text, hits)) {
      const key = [...skillIds].sort().join("|");
      const old = byGroup.get(key);
      if (!old || priority[kind] > priority[old.kind]) {
        byGroup.set(key, { kind, skillIds, evidence: text.trim() });
      }
    }
  }
  record(normalizeText(title), "mentioned");
  const lines = normalizeText(description).split(/\n|[。；;!?！？]|\.(?=\s+(?:[A-Z]|[•\-])|\s*$)/);
  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    const heading = headingKind(line);
    if (heading) {
      section = heading;
      continue;
    }
    const prefix = /^(?:【([^】]+)】|([^:]{1,45}):)\s*(.*)$/.exec(line);
    if (prefix) {
      const inlineKind = headingKind(prefix[1] ?? prefix[2] ?? "");
      if (inlineKind) {
        section = inlineKind;
        line = prefix[3];
      }
    }
    for (const clause of clauses(line)) record(clause, section);
  }
  return { role: classifyRole(title, description), requirements: [...byGroup.values()] };
}
