import { ROLE_LABELS, SKILLS, type Job, type RequirementKind } from "@job/domain";

export const KIND_LABELS: Record<RequirementKind, string> = {
  required: "必備",
  preferred: "加分",
  mentioned: "僅提及",
};
const skillNames = new Map<string, string>(SKILLS.map((skill) => [skill.id, skill.label]));
export const skillLabel = (id: string) => skillNames.get(id) ?? id;

export function jobSkills(job: Job, kind?: RequirementKind) {
  return [
    ...new Set(
      job.requirements.filter((item) => !kind || item.kind === kind).flatMap((item) => item.skillIds),
    ),
  ];
}
export function frequency(jobs: Job[], kind?: RequirementKind) {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const skill of jobSkills(job, kind)) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts].sort(
    (a, b) => b[1] - a[1] || skillLabel(a[0]).localeCompare(skillLabel(b[0]), "zh-TW"),
  );
}
export function cityOf(location: string) {
  return (
    location.replaceAll("臺", "台").match(/[\u3400-\u9fff]{2,3}[縣市]/u)?.[0] || location.trim() || "未提供"
  );
}
export function dateLabel(value: string | null) {
  if (!value) return "未提供";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "未提供"
    : new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
}
export function searchableText(job: Job) {
  return [
    job.title,
    job.company,
    job.location,
    job.description,
    ROLE_LABELS[job.role],
    ...jobSkills(job).map(skillLabel),
  ]
    .join(" ")
    .toLowerCase()
    .replaceAll("臺", "台");
}
