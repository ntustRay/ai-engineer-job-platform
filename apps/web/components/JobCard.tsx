import { ROLE_LABELS, matchJob, type Job } from "@job/domain";
import { Icon } from "./icons";
import { dateLabel, jobSkills, skillLabel } from "./market-display";

type Props = {
  job: Job;
  skills: string[];
  favorite: boolean;
  applied: boolean;
  firstSeen: string | null;
  onOpen: (job: Job) => void;
  onFavorite: () => void;
  ready: boolean;
};

export function JobCard({ job, skills, favorite, applied, firstSeen, onOpen, onFavorite, ready }: Props) {
  const matching = matchJob(job, skills);
  const tags = jobSkills(job);
  const required = matching.matched.length + matching.missing.length;
  return (
    <article className="atlas-job">
      <div className="atlas-job-top">
        <span className="atlas-role">{ROLE_LABELS[job.role]}</span>
        {applied && (
          <span className="atlas-applied">
            <Icon name="check" size={13} />
            已投遞
          </span>
        )}
        <button
          type="button"
          className="atlas-icon-btn atlas-bookmark"
          aria-pressed={favorite}
          aria-label={`${favorite ? "取消收藏" : "收藏"} ${job.title}`}
          disabled={!ready}
          onClick={onFavorite}
        >
          <Icon name="bookmark" size={17} filled={favorite} />
        </button>
      </div>
      <h3>
        <button type="button" onClick={() => onOpen(job)}>{job.title}</button>
      </h3>
      <p className="atlas-company">{job.company}</p>
      <div className="atlas-job-meta">
        <span>
          <Icon name="pin" size={14} />
          {job.location || "地點未提供"}
        </span>
        {firstSeen ? (
          <span>
            <Icon name="calendar" size={14} />
            {dateLabel(firstSeen)} 首次收錄
          </span>
        ) : (
          job.updatedAt && (
            <span>
              <Icon name="calendar" size={14} />
              {dateLabel(job.updatedAt)} 更新
            </span>
          )
        )}
      </div>
      {(tags.length > 0 || skills.length > 0) && (
        <div className="atlas-job-foot">
          <div className="atlas-tags">
            {tags.slice(0, 5).map((id) => (
              <span key={id} className={skills.includes(id) ? "atlas-tag atlas-tag-owned" : "atlas-tag"}>
                {skillLabel(id)}
              </span>
            ))}
            {tags.length > 5 && <span className="atlas-tag">+{tags.length - 5}</span>}
          </div>
          {skills.length > 0 && (
            <span className="atlas-match">
              {required ? `符合 ${matching.matched.length}/${required} 項必備` : "未辨識必備條件"}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
