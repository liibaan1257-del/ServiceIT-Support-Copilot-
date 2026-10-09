import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        ServiceIT Support Copilot - Ready for API generation
      </h1>
      <Link
        href="/admin"
        className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
      >
        Open admin dashboard
      </Link>
    </main>
  );
}
