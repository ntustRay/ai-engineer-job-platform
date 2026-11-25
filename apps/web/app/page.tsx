import { loadMarket } from "../lib/market";
import { Workspace } from "../components/Workspace";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, market] = await Promise.all([searchParams, loadMarket()]);
  return <Workspace view={view === "trends" || view === "skills" ? view : "jobs"} market={market} />;
}
