interface SkillDefinition {
  id: string;
  label: string;
  category: string;
  pattern: RegExp;
  implies?: string[];
}

// ASCII word boundaries allow mixed text such as「熟悉TypeScript開發」.
const definitions: SkillDefinition[] = [
  { id: "typescript", label: "TypeScript", category: "程式語言", pattern: /\b(?:TypeScript|TS)\b/gi },
  { id: "javascript", label: "JavaScript", category: "程式語言", pattern: /\b(?:JavaScript|JS|ECMAScript)\b/gi },
  { id: "python", label: "Python", category: "程式語言", pattern: /\bPython\b/gi },
  { id: "java", label: "Java", category: "程式語言", pattern: /\bJava\b/gi },
  { id: "go", label: "Go", category: "程式語言", pattern: /\b(?:Golang|Go)(?=\s*語言|\s*(?:\/|、|開發|程式))|\bGolang\b|\bGo\b(?=\s*(?:[,.;)]|$))/g },
  { id: "csharp", label: "C#", category: "程式語言", pattern: /\bC#|\bC[ -]?Sharp\b/gi },
  { id: "cpp", label: "C++", category: "程式語言", pattern: /\bC\+\+/gi },
  { id: "rust", label: "Rust", category: "程式語言", pattern: /\bRust\b/gi },
  { id: "sql", label: "SQL", category: "資料", pattern: /\bSQL\b/gi },
  { id: "postgresql", label: "PostgreSQL", category: "資料", pattern: /\bPostgres(?:ql)?\b/gi },
  { id: "etl", label: "ETL", category: "資料", pattern: /\bETL\b/gi },
  { id: "react", label: "React", category: "前端", pattern: /\bReact(?:[.]?js)?\b/gi },
  { id: "vue", label: "Vue", category: "前端", pattern: /\bVue(?:[.]?js)?\b/gi },
  { id: "angular", label: "Angular", category: "前端", pattern: /\bAngular(?:js)?\b/gi },
  { id: "nextjs", label: "Next.js", category: "前端", pattern: /\bNext[.]?js\b/gi },
  { id: "css", label: "CSS", category: "前端", pattern: /\bCSS(?:3)?\b/gi },
  { id: "nodejs", label: "Node.js", category: "後端", pattern: /\bNode[.]?js\b/gi },
  { id: "docker", label: "Docker", category: "維運", pattern: /\bDocker\b/gi },
  { id: "kubernetes", label: "Kubernetes", category: "維運", pattern: /\b(?:Kubernetes|K8s)\b/gi },
  { id: "cicd", label: "CI/CD", category: "維運", pattern: /\bCI\s*[/-]\s*CD\b|持續整合(?:與|及|和|[ /])*持續(?:交付|部署)/gi },
  { id: "terraform", label: "Terraform", category: "維運", pattern: /\bTerraform\b/gi },
  { id: "aws", label: "AWS", category: "雲端", pattern: /\b(?:AWS|Amazon Web Services)\b/gi },
  { id: "gcp", label: "Google Cloud", category: "雲端", pattern: /\b(?:GCP|Google Cloud(?: Platform)?)\b/gi },
  { id: "azure", label: "Azure", category: "雲端", pattern: /\bAzure\b/gi },
  { id: "automated-testing", label: "測試自動化", category: "品質", pattern: /自動化測試|測試自動化|\b(?:automated testing|test automation|automated tests)\b/gi },
  { id: "unit-testing", label: "單元測試", category: "品質", pattern: /單元測試|\bunit test(?:ing|s)?\b/gi, implies: ["automated-testing"] },
  { id: "e2e-testing", label: "端對端測試", category: "品質", pattern: /端對端測試|\b(?:end[- ]to[- ]end|e2e) test(?:ing|s)?\b|\be2e\b/gi, implies: ["automated-testing"] },
  { id: "vitest", label: "Vitest", category: "品質", pattern: /\bVitest\b/gi, implies: ["unit-testing", "automated-testing"] },
  { id: "jest", label: "Jest", category: "品質", pattern: /\bJest\b/gi, implies: ["unit-testing", "automated-testing"] },
  { id: "playwright", label: "Playwright", category: "品質", pattern: /\bPlaywright\b/gi, implies: ["automated-testing"] },
  { id: "design-systems", label: "Design Systems", category: "設計", pattern: /\bdesign systems?\b|設計系統/gi },
  { id: "figma", label: "Figma", category: "設計", pattern: /\bFigma\b/gi },
  { id: "accessibility", label: "無障礙設計", category: "設計", pattern: /\b(?:a11y|WCAG|accessibility)\b|無障礙(?:設計|網頁|網站)/gi },
  { id: "llm", label: "大型語言模型", category: "AI", pattern: /\bLLMs?\b|大型語言模型|大語言模型/gi },
  { id: "llm-api", label: "模型 API 整合", category: "AI", pattern: /\b(?:LLM|OpenAI|Anthropic|Gemini) APIs?\b|(?:模型|生成式\s*AI)\s*API\s*(?:串接|整合)?/gi },
  { id: "rag", label: "RAG", category: "AI", pattern: /\bRAG\b|\bretrieval[- ]augmented generation\b|檢索增強(?:式)?生成/gi },
  { id: "llm-evaluation", label: "LLM 評估", category: "AI", pattern: /\bLLM eval(?:uation)?s?\b|(?:語言模型|LLM)\s*(?:評估|評測)/gi },
  { id: "mlops", label: "MLOps", category: "AI", pattern: /\bMLOps\b/gi },
  { id: "pytorch", label: "PyTorch", category: "AI", pattern: /\bPyTorch\b/gi },
  { id: "prompt-engineering", label: "Prompt Engineering", category: "AI", pattern: /\bprompt engineering\b|提示(?:詞)?工程/gi },
  { id: "fine-tuning", label: "模型微調", category: "AI", pattern: /\bfine[- ]tuning\b|模型微調/gi },
];

export const SKILLS = definitions.map(({ id, label, category }) => ({ id, label, category }));
const implications = new Map(definitions.map(({ id, implies }) => [id, implies ?? []]));

export function expandSkills(skills: readonly string[]): Set<string> {
  const result = new Set(skills);
  for (const skill of result) {
    for (const related of implications.get(skill) ?? []) result.add(related);
  }
  return result;
}

export interface SkillHit {
  id: string;
  start: number;
  end: number;
}

export function findSkills(text: string): SkillHit[] {
  const hits: SkillHit[] = [];
  for (const { id, pattern } of definitions) {
    for (const match of text.matchAll(pattern)) {
      hits.push({ id, start: match.index, end: match.index + match[0].length });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: SkillHit[] = [];
  for (const hit of hits) {
    const previous = result.at(-1);
    if (!previous || hit.start >= previous.end) result.push(hit);
  }
  return result;
}
