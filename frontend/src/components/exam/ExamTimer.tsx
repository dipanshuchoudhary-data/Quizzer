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
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClearAnswer: () => void;
  flagged: boolean;
  savedCount: number;
  totalQuestions: number;
  pendingSyncCount: number;
  violationCount: number;
  violationLimit?: number;
  markDeductionPerViolation?: number;
  disableActions?: boolean;
}

export function ExamTimer({
  remainingTime,
  onSubmit,
  onFlag,
  flagged,
  savedCount,
  totalQuestions,
  pendingSyncCount,
  violationCount,
  violationLimit,
  markDeductionPerViolation,
  disableActions,
}: ExamTimerProps) {
  const danger = remainingTime <= 300;
  const criticalTime = remainingTime <= 60;
  const violationsNearLimit = violationLimit && violationCount >= violationLimit - 2;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:rounded-2xl sm:p-4 lg:sticky lg:top-4">
      {/* Timer Display */}
      <div className="flex items-center justify-between lg:flex-col lg:items-start">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
            Time Left
          </h3>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl ${
              criticalTime
                ? "animate-pulse text-rose-600"
                : danger
                ? "text-rose-600"
                : "text-slate-900"
            }`}
          >
            {formatSeconds(remainingTime)}
          </p>
        </div>

        {/* Mobile: Submit button inline */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableActions}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-rose-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
        >
          Submit
        </button>
      </div>

      {/* Stats Grid */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:mt-4 lg:grid-cols-1 lg:text-left">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:p-3">
          <p className="text-lg font-bold text-emerald-600 sm:text-xl">
            {savedCount}/{totalQuestions}
          </p>
          <p className="text-[10px] text-slate-500 sm:text-xs">Saved</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:p-3">
          <p className="text-lg font-bold text-amber-600 sm:text-xl">{pendingSyncCount}</p>
          <p className="text-[10px] text-slate-500 sm:text-xs">Syncing</p>
        </div>
        <div
          className={`rounded-lg border p-2 sm:p-3 ${
            violationsNearLimit
              ? "border-rose-300 bg-rose-50"
              : violationCount > 0
              ? "border-amber-300 bg-amber-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <p
            className={`text-lg font-bold sm:text-xl ${
              violationsNearLimit
                ? "text-rose-600"
                : violationCount > 0
                ? "text-amber-600"
                : "text-slate-600"
            }`}
          >
            {violationCount}
            {violationLimit && <span className="text-sm font-normal">/{violationLimit}</span>}
          </p>
          <p className="text-[10px] text-slate-500 sm:text-xs">Violations</p>
        </div>
      </div>

      {/* Mark deduction info */}
      {markDeductionPerViolation && markDeductionPerViolation > 0 && violationCount > 0 && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-center sm:mt-3">
          <p className="text-xs font-medium text-rose-700 sm:text-sm">
            -{violationCount * markDeductionPerViolation} marks deducted
          </p>
        </div>
      )}

      {/* Warning when approaching limit */}
      {violationsNearLimit && (
        <div className="mt-2 rounded-lg border border-rose-300 bg-rose-100 p-2 sm:mt-3 sm:p-3">
          <p className="text-xs font-semibold text-rose-800 sm:text-sm">
            ⚠️ Warning: {violationLimit! - violationCount} violations left
          </p>
          <p className="mt-0.5 text-[10px] text-rose-700 sm:text-xs">
            Exam will auto-submit at limit
          </p>
        </div>
      )}

      {/* Desktop Actions */}
      <div className="mt-4 hidden space-y-2 lg:block">
        <button
          type="button"
          onClick={onFlag}
          disabled={disableActions}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition duration-150 hover:brightness-105 active:scale-[0.98] ${
            flagged
              ? "border-amber-500 bg-amber-50 text-amber-700"
              : "border-slate-300 bg-white text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {flagged ? "🚩 Flagged" : "Flag Question"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableActions}
          className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-rose-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit Exam
        </button>
      </div>

      {/* Mobile Flag Button */}
      <div className="mt-3 lg:hidden">
        <button
          type="button"
          onClick={onFlag}
          disabled={disableActions}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${
            flagged
              ? "border-amber-500 bg-amber-50 text-amber-700"
              : "border-slate-300 bg-white text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {flagged ? "🚩 Flagged" : "Flag"}
        </button>
      </div>

      {/* Info Box - Desktop only */}
      <div className="mt-4 hidden rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-500 lg:block sm:p-3 sm:text-xs">
        Switching tabs, exiting fullscreen, or copy/paste attempts are recorded as violations.
      </div>
    </aside>
  );
}
