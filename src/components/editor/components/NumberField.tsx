import { useState } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  // Appended to the displayed value (e.g. a degree sign); not part of the input.
  suffix?: string;
  className?: string;
}

const STEP = 1;
const STEP_LARGE = 10;

// Stored values come from drags and can carry long fractions.
function format(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '';
}

// A compact numeric input for exact values. Typing is committed on Enter or
// when the field loses focus; the arrow keys step by 1 (10 with Shift) and
// apply immediately. Escape restores the current value.
export function NumberField({ label, value, onCommit, min, max, suffix, className }: NumberFieldProps) {
  // Non-null only while the user is typing; otherwise the field shows `value`.
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (next: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));

  const commit = (text: string) => {
    setDraft(null);
    const parsed = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(parsed)) return;
    const next = clamp(parsed);
    if (next !== value) onCommit(next);
  };

  return (
    <label className={`flex items-center gap-1.5 rounded bg-[#2b2b2b] px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 ${className ?? ''}`}>
      <span className="shrink-0 text-[11px] font-medium text-gray-400">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? format(value)}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={(event) => {
          if (draft !== null) commit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit(event.currentTarget.value);
            event.currentTarget.select();
          } else if (event.key === 'Escape') {
            setDraft(null);
            event.currentTarget.blur();
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const base = Number((draft ?? format(value)).replace(',', '.'));
            if (!Number.isFinite(base)) return;
            const step = (event.shiftKey ? STEP_LARGE : STEP) * (event.key === 'ArrowUp' ? 1 : -1);
            commit(String(base + step));
          }
        }}
        // The label draws the focus ring for the whole field.
        style={{ outline: 'none' }}
        className="w-full min-w-0 bg-transparent text-right text-xs tabular-nums text-gray-100"
      />
      {suffix && <span className="shrink-0 text-[11px] text-gray-400">{suffix}</span>}
    </label>
  );
}
