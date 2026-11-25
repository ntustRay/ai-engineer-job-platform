import type { Job, Requirement, RequirementKind, RoleId } from "./model";
import { findSkills, type SkillHit } from "./skills";

export const RULES_VERSION = "2026-11-26.1";

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

export function classifyRole(title: string, _description?: string): RoleId {
  const text = normalizeText(title);
  return roles.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
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
  return { role: classifyRole(title), requirements: [...byGroup.values()] };
}
