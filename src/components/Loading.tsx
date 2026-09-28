export default function Loading({ label = 'Running analysis…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-stone-400 text-sm gap-3">
      <div className="w-4 h-4 border border-stone-600 border-t-amber-600 rounded-full animate-spin" />
      {label}
    </div>
  );
}
