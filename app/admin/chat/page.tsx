import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  return <ComingSoon title="Chat" description="Talk to the AI support copilot." part={4} />;
}
