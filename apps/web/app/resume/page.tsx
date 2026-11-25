import { headers } from 'next/headers';
import { getAccountContext } from '../../lib/account';
import { getCurrentJob } from '../../lib/market';
import ResumeStudio from './studio';
import './studio.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '履歷工作室｜職域圖譜' };

export default async function ResumePage({ searchParams }: { searchParams: Promise<{job?: string | string[]}> }) {
  const { job: id } = await searchParams;
  const selectedId = typeof id === 'string' && id.length <= 240 ? id : '';
  const [job, account] = await Promise.all([
    selectedId ? getCurrentJob(selectedId) : null,
    getAccountContext(await headers()).catch(() => ({ status: 'unavailable' as const })),
  ]);
  return <ResumeStudio
    accountStatus={account.status}
    missingJob={Boolean(selectedId && !job)}
    initialJob={job ? { title: job.title, company: job.company, description: job.description } : null}
  />;
}
