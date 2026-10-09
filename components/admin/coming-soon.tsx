import { PageTitle } from "@/components/admin/page-title";

/** Placeholder for sections built in a later part (no fake data). */
export function ComingSoon({ title, description, part }: { title: string; description: string; part: number }) {
  return (
    <>
      <PageTitle title={title} description={description} />
      <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
        <p className="text-sm font-medium text-zinc-300">Coming in Part {part}</p>
        <p className="mt-1 text-sm text-zinc-500">This section is planned and will use real data once it&apos;s built.</p>
      </div>
    </>
  );
}
