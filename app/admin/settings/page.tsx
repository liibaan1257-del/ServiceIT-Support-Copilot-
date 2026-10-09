import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/admin/page-title";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { requireAdmin } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/settings/settings";

export const metadata: Metadata = { title: "Settings" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" description="How the AI copilot behaves, and its limits." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" aria-busy="true" aria-label="Loading settings" />}>
        <SettingsView />
      </Suspense>
    </>
  );
}

async function SettingsView() {
  const me = await requireAdmin("/admin/settings");
  if (!me) return null;
  const settings = await getAppSettings();
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-zinc-500">
        {settings.updatedAt ? `Last changed ${dateTime.format(new Date(settings.updatedAt))} UTC.` : "Using the default settings."}
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
