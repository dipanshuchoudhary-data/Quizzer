"use client";

function formatSeconds(seconds: number) {
  const s = Math.max(0, seconds);
  const hh = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

interface ExamTimerProps {
  remainingTime: number;
  onSubmit: () => void;
  onFlag: () => void;
  flagged: boolean;
  disableActions?: boolean;
}

export function ExamTimer({ remainingTime, onSubmit, onFlag, flagged, disableActions }: ExamTimerProps) {
  const danger = remainingTime <= 300;

  return (
    <aside className="h-full rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time Remaining</h3>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${danger ? "text-rose-600" : "text-slate-900"}`}>
        {formatSeconds(remainingTime)}
      </p>
      <p className="mt-2 text-xs text-slate-500">Timer display syncs with the backend every few seconds. Local time is visual only.</p>

      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={onFlag}
          disabled={disableActions}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold ${
            flagged ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {flagged ? "Flagged" : "Flag Question"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableActions}
          className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit Exam
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Leaving fullscreen, switching tabs, or attempting copy/paste is recorded as an integrity violation.
      </div>
    </aside>
  );
}
