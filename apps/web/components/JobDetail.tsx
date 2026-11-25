import Link from "next/link";
import { useEffect, useRef } from "react";
import { ROLE_LABELS, matchJob, type Job } from "@job/domain";
import { Icon } from "./icons";
import { dateLabel, KIND_LABELS, skillLabel } from "./market-display";

type Props = {
  job: Job;
  skills: string[];
  applied: boolean;
  archived: boolean;
  onDismiss: () => void;
  onApply: () => void;
  ready: boolean;
};

export function JobDetail({ job, skills, applied, archived, onDismiss, onApply, ready }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const match = matchJob(job, skills);
  let externalUrl: URL | null = null;
  try {
    const url = new URL(job.url);
    if (["https:", "http:"].includes(url.protocol)) externalUrl = url;
  } catch {
    /* A source record can lack a usable URL. */
  }
  return (
    <dialog
      ref={ref}
      className="atlas-dialog"
      aria-labelledby="atlas-job-heading"
      onCancel={onDismiss}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className="atlas-dialog-inside">
        <div className="atlas-dialog-top">
          <span className="atlas-role">{ROLE_LABELS[job.role]}</span>
          <button className="atlas-icon-btn" type="button" aria-label="關閉職缺內容" onClick={onDismiss}>
            <Icon name="close" />
          </button>
        </div>
        <h2 id="atlas-job-heading">{job.title}</h2>
        <p className="atlas-company">{job.company}</p>
        <dl className="atlas-details-meta">
          <div>
            <dt>工作地點</dt>
            <dd>{job.location || "未提供"}</dd>
          </div>
          <div>
            <dt>來源更新</dt>
            <dd>{dateLabel(job.updatedAt)}</dd>
          </div>
          <div>
            <dt>應徵截止</dt>
            <dd>{dateLabel(job.expiresAt)}</dd>
          </div>
        </dl>
        {archived && <p className="atlas-note">這是當期觀測到的職缺版本。請到原站確認目前是否仍開放。</p>}
        <div className="atlas-actions">
          {externalUrl && (
            <a href={externalUrl.href} rel="noopener noreferrer" target="_blank" className="atlas-primary">
              查看職缺原站
              <Icon name="external" size={15} />
            </a>
          )}
          {!archived && (
            <>
              <Link className="atlas-secondary" href={`/resume?job=${encodeURIComponent(job.id)}`}>
                製作這份履歷
              </Link>
              <button
                type="button"
                className="atlas-secondary"
                disabled={!ready}
                aria-pressed={applied}
                onClick={onApply}
              >
                {applied ? "取消已投遞標記" : "標記已投遞"}
              </button>
            </>
          )}
        </div>
        <h3>技能條件與原文</h3>
        {job.requirements.length ? (
          <ul className="atlas-evidence">
            {job.requirements.map((r) => (
              <li key={JSON.stringify([r.kind, r.skillIds, r.evidence])}>
                <div>
                  <span className={`atlas-kind atlas-kind-${r.kind}`}>{KIND_LABELS[r.kind]}</span>
                  <strong>{r.skillIds.map(skillLabel).join(" 或 ")}</strong>
                  {skills.length > 0 && [...match.matched, ...match.preferred].includes(r) && (
                    <span className="atlas-confirmed">
                      <Icon name="check" size={13} />
                      已符合
                    </span>
                  )}
                </div>
                <p>{r.evidence}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="atlas-note">尚未從這份職缺辨識出技能條件，可直接閱讀下方的工作內容。</p>
        )}
        <h3>工作內容</h3>
        <p className="atlas-description">{job.description || "來源未提供工作內容。"}</p>
      </div>
    </dialog>
  );
}
