import { WATERMARK } from '../lib/api';

export default function Watermark({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-stone-500 border border-stone-700/60 bg-stone-900/80 px-2 py-1.5 rounded ${className}`}>
      {WATERMARK}
    </p>
  );
}
