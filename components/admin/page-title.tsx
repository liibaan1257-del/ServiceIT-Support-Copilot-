export function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
    </div>
  );
}
