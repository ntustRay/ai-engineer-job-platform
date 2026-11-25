export const ROLE_LABELS = {
  frontend: "前端工程",
  backend: "後端工程",
  fullstack: "全端工程",
  devops: "DevOps / 平台工程",
  qa: "軟體測試",
  design: "產品設計",
  data: "資料工程與分析",
  ai: "AI / 機器學習",
  mobile: "行動應用",
  security: "資安工程",
  software: "軟體工程",
  other: "其他職位",
};

export type RoleId = keyof typeof ROLE_LABELS;
export type RequirementKind = "required" | "preferred" | "mentioned";

/** A candidate can meet a requirement with any one skill in skillIds. */
export interface Requirement {
  kind: RequirementKind;
  skillIds: string[];
  evidence: string;
}

export interface Job {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  updatedAt: string | null;
  expiresAt: string | null;
  role: RoleId;
  requirements: Requirement[];
}
