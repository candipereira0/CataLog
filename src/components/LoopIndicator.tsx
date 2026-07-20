interface LoopIndicatorProps {
  loopStart: number;
  loopEnd: number;
  duration: number;
  loopBars: number;
  isActive: boolean;
}

export default function LoopIndicator({
  loopStart,
  loopEnd,
  duration,
  loopBars,
  isActive,
}: LoopIndicatorProps) {
  if (!isActive) return null;

  const startPct = duration > 0 ? (loopStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (loopEnd / duration) * 100 : 0;
  const widthPct = Math.max(0, endPct - startPct);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute top-0 h-full border-l-2 border-r-2 border-violet-400 bg-violet-500/30"
        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
      >
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-violet-300">
          {loopBars} bar{loopBars !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
