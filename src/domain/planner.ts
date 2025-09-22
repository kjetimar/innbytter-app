export type PlayerId = string;
export interface PlannerInput {
  playerIds: PlayerId[];
  keeperIds?: PlayerId[];
  onFieldCount: number;
  halves: number;
  halfLengthMin: number;
  subIntervalMin: number;
  keeperRarity?: number;
  historyMinutes?: Record<PlayerId, number>;
}
export interface PlanWindow { minute: number; ins: PlayerId[]; outs: PlayerId[]; }
export interface PlannedMatch { windows: PlanWindow[]; lineupByWindow: PlayerId[][]; plannedMinutes: Record<PlayerId, number>; }

export function generatePlan(input: PlannerInput): PlannedMatch {
  const {
    playerIds, keeperIds = [], onFieldCount,
    halves, halfLengthMin, subIntervalMin,
    keeperRarity = 1, historyMinutes = {}
  } = input;

  if (onFieldCount <= 0) throw new Error('onFieldCount må være > 0');
  if (playerIds.length < onFieldCount) throw new Error('Færre spillere enn påkrevd på banen.');

  const totalMin = halves * halfLengthMin;
  const windowsPerHalf = Math.floor(halfLengthMin / subIntervalMin);
  const totalWindows = windowsPerHalf * halves;
  const windowMinutes = Array.from({ length: totalWindows }, (_, i) => (i + 1) * subIntervalMin);

  const minutesAcc: Record<PlayerId, number> = {};
  const benchStreak: Record<PlayerId, number> = {};
  playerIds.forEach(id => { minutesAcc[id] = historyMinutes[id] ?? 0; benchStreak[id] = 0; });

  const sorted = [...playerIds].sort((a, b) => (minutesAcc[a] - minutesAcc[b]));
  let lineup = sorted.slice(0, onFieldCount);
  let bench = sorted.slice(onFieldCount);

  const windows: PlanWindow[] = [];
  const lineupByWindow: PlayerId[][] = [ [...lineup] ];
  const plannedMinutes: Record<PlayerId, number> = Object.fromEntries(playerIds.map(id => [id, 0]));

  const isKeeperWindow = (wIndex: number) => (wIndex % keeperRarity === keeperRarity - 1);

  const addMinutesToLineup = (delta: number) => {
    lineup.forEach(id => { plannedMinutes[id] += delta; minutesAcc[id] += delta; benchStreak[id] = 0; });
    bench.forEach(id => { benchStreak[id] += 1; });
  };

  addMinutesToLineup(subIntervalMin);

  for (let w = 0; w < totalWindows - 1; w++) {
    const canSwap = Math.min(bench.length, lineup.length);
    if (canSwap === 0) {
      addMinutesToLineup(subIntervalMin);
      lineupByWindow.push([...lineup]);
      continue;
    }

    let locked: Set<PlayerId> = new Set();
    if (keeperIds.length > 0 && !isKeeperWindow(w)) {
      const keeperOnField = lineup.find(id => keeperIds.includes(id));
      if (keeperOnField) locked.add(keeperOnField);
    }

    const benchSorted = [...bench].sort((a, b) => {
      const streakDiff = (benchStreak[b] - benchStreak[a]);
      if (streakDiff !== 0) return streakDiff;
      return minutesAcc[a] - minutesAcc[b];
    });

    const lineupSorted = [...lineup].sort((a, b) => (minutesAcc[b] - minutesAcc[a]));

    const swaps: Array<{ out: PlayerId; inn: PlayerId; }> = [];
    const targetSwaps = Math.max(1, Math.floor(onFieldCount / 2));
    for (let k = 0; k < targetSwaps && k < canSwap; k++) {
      const candidateIn = benchSorted[k];
      const candidateOut = lineupSorted.find(id => !locked.has(id));
      if (!candidateIn || !candidateOut) break;
      swaps.push({ out: candidateOut, inn: candidateIn });
      locked.add(candidateOut);
    }

    swaps.forEach(s => {
      lineup = lineup.filter(id => id !== s.out).concat(s.inn);
      bench = bench.filter(id => id !== s.inn).concat(s.out);
      benchStreak[s.inn] = 0;
    });

    windows.push({ minute: windowMinutes[w], ins: swaps.map(s => s.inn), outs: swaps.map(s => s.out) });
    addMinutesToLineup(subIntervalMin);
    lineupByWindow.push([...lineup]);
  }

  windows.push({ minute: totalMin, ins: [], outs: [] });
  return { windows, lineupByWindow, plannedMinutes };
}
