import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  return <ComingSoon title="Users" description="Customers, technicians and admins." part={3} />;
}
