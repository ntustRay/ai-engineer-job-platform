export type Material = { id: string; text: string };
export type ResumeSection = { heading: string; bullets: { text: string; sources: string[] }[] };

export const MATERIAL_LIMIT = 15000;
export const JOB_LIMIT = 6000;

// The user sees the exact outgoing passages and can remove anything else before sending.
export function redactContacts(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '〔電子郵件已省略〕')
    .replace(/(?<!\d)(?:(?:\+886[- (]*)?0?9\d{2}[- )]*\d{3}[- ]*\d{3}|(?:\+886[- (]*|\(?0)[2-8]\)?[- ]*\d{3,4}[- ]*\d{4})(?!\d)/g, '〔電話已省略〕');
}

export function makeMaterials(resume: string, projects: string): Material[] {
  const parts = [resume, projects].flatMap((value) =>
    redactContacts(value).replace(/\r\n?/g, '\n').split(/\n\s*\n/g),
  ).map((value) => value.trim()).filter(Boolean);
  return parts.map((text, i) => ({ id: `E${i + 1}`, text }));
}

export function formatSections(sections: ResumeSection[]): string {
  return sections.map((section) => [
    `## ${section.heading}`,
    ...section.bullets.map((bullet) => `- ${bullet.text}`),
  ].join('\n')).join('\n\n');
}
