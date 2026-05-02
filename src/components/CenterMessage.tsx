// Floating hint shown when permissions/loading are in progress.
export function CenterMessage({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-display text-3xl font-bold">{title}</h2>
      {sub && <p className="max-w-md text-lg text-muted-foreground">{sub}</p>}
    </div>
  );
}
