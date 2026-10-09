import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Rate Limits" };

export default function Page() {
  return <ComingSoon title="Rate Limits" description="Request limits per user and endpoint." part={5} />;
}
