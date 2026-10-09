import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Audit Log" };

export default function Page() {
  return <ComingSoon title="Audit Log" description="Who did what, and when." part={5} />;
}
