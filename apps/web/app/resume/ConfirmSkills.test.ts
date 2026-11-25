import { expect, test } from "bun:test";
import { findSkillCandidates } from "./ConfirmSkills";

test("resume skill suggestions deduplicate skills across evidence and keep personal contact info out of excerpts", () => {
  const skills = findSkillCandidates("I built a React application (me@example.com).", "React with Playwright.");
  expect(skills.filter(s => s.id === "react")).toHaveLength(1);
  expect(skills.find(s => s.id === "react")?.excerpt).not.toContain("me@example.com");
  expect(skills.find(s => s.id === "playwright")?.source).toBe("作品");
  expect(findSkillCandidates("", "")).toEqual([]);
});
