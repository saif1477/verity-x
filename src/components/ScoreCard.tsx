import { useState } from 'react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'neutral' | 'warn' | 'risk' | 'ok';
  detail?: React.ReactNode;
}

const tones = {
  neutral: 'border-stone-700',
  warn: 'border-amber-800/80',
  risk: 'border-rose-900/80',
  ok: 'border-emerald-900/60',
};

export default function ScoreCard({ label, value, sub, tone = 'neutral', detail }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => detail && setOpen((o) => !o)}
      className={`text-left border ${tones[tone]} bg-stone-900/60 px-3 py-2.5 rounded-sm w-full ${detail ? 'cursor-pointer hover:bg-stone-900' : 'cursor-default'}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-stone-100 mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-stone-500 mt-0.5">{sub}</div>}
      {open && detail && <div className="mt-2 pt-2 border-t border-stone-800 text-[11px] text-stone-400 space-y-1">{detail}</div>}
      {detail && !open && <div className="text-[10px] text-stone-600 mt-1">Click for calculation</div>}
    </button>
  );
}
