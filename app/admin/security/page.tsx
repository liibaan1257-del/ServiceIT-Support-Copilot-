import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <ComingSoon title="Security" description="API keys, webhook secrets and access." part={5} />;
}
