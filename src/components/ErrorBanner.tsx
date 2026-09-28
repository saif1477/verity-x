export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border border-rose-900/60 bg-rose-950/30 text-rose-200/90 text-sm px-3 py-2 rounded-sm mb-4">
      {message}
    </div>
  );
}
