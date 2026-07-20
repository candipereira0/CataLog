export function barsToSeconds(bpm: number, bars: number): number {
  return (bars * 240) / bpm;
}

export function getLoopRegion(
  currentTime: number,
  bpm: number,
  bars: number
): { start: number; end: number } {
  const start = snapToBar(currentTime, bpm);
  const end = start + barsToSeconds(bpm, bars);
  return { start, end };
}

export function snapToBar(time: number, bpm: number): number {
  const barDuration = 240 / bpm;
  return Math.round(time / barDuration) * barDuration;
}

export function getSuggestedLoopBars(bpm: number): number {
  if (bpm < 90) return 4;
  if (bpm < 140) return 8;
  return 16;
}
