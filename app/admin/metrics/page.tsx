import type { Metadata } from "next";
import { MetricsPanel } from "@/components/admin/metrics-panel";
import { PageTitle } from "@/components/admin/page-title";

export const metadata: Metadata = { title: "Metrics" };

export default function MetricsPage() {
  return (
    <>
      <PageTitle title="Metrics" description="Live request counters from the API." />
      <MetricsPanel />
    </>
  );
}
