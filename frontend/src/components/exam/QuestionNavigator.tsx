"use client";

import { cn } from "@/lib/utils";

interface QuestionNavigatorProps {
  questionIds: string[];
  currentQuestionId: string | null;
  answeredIds: Set<string>;
  visitedIds: Set<string>;
  flaggedIds: Set<string>;
  onSelect: (questionId: string) => void;
}

export function QuestionNavigator({
  questionIds,
  currentQuestionId,
  answeredIds,
  visitedIds,
  flaggedIds,
  onSelect,
}: QuestionNavigatorProps) {
  return (
    <aside className="h-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Question Navigator</h3>
      <div className="grid grid-cols-4 gap-2">
        {questionIds.map((id, idx) => {
          const isCurrent = id === currentQuestionId;
          const isAnswered = answeredIds.has(id);
          const isVisited = visitedIds.has(id);
          const isFlagged = flaggedIds.has(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "relative rounded-lg border px-2 py-2 text-xs font-semibold transition",
                "hover:border-slate-400",
                isCurrent && "border-blue-700 bg-blue-700 text-white",
                !isCurrent && isAnswered && "border-emerald-600 bg-emerald-50 text-emerald-700",
                !isCurrent && !isAnswered && isVisited && "border-amber-500 bg-amber-50 text-amber-700",
                !isCurrent && !isAnswered && !isVisited && "border-slate-200 bg-slate-50 text-slate-600"
              )}
            >
              Q{idx + 1}
              {isFlagged ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1 text-xs text-slate-600">
        <p><span className="font-semibold">Green:</span> Answered</p>
        <p><span className="font-semibold">Amber:</span> Visited</p>
        <p><span className="font-semibold">Gray:</span> Not visited</p>
        <p><span className="font-semibold">Red Dot:</span> Flagged</p>
      </div>
    </aside>
  );
}
