// src/screens/PlanView.tsx
import { useEffect, useState } from 'react'
import { db, Player } from '@/db/schema'
import { generatePlan } from '@/domain/planner'
import { Link, useParams, useNavigate } from 'react-router-dom'

export default function PlanView() {
  const { matchId } = useParams()
  const nav = useNavigate()

  const [match, setMatch] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [plan, setPlan] = useState<any>(null)

  // for visning av line-up etter hvert vindu
  const [startLineup, setStartLineup] = useState<string[]>([])
  const [lineupsAfterWindow, setLineupsAfterWindow] = useState<string[][]>([])
  const [keeperIds, setKeeperIds] = useState<string[]>([])

  useEffect(() => {
    (async () => {
      if (!matchId) return

      const m = await db.matches.get(matchId)
      if (!m) return
      setMatch(m)

      const ps = await db.players.where('teamId').equals(m.teamId).toArray()
      setPlayers(ps)

      // hent keeperkandidater fra historikk + de navnene trener har skrevet i setup
      const hist = await db.history.where('playerId').anyOf(ps.map(p => p.id)).toArray()
      const fromHistory = hist.filter(h => h.lastPosition === 'keeper').map(h => h.playerId)
      const namesLC = (m.keeperNamesRaw ?? '')
        .split(/[,\n;]+/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
      const fromNames = ps
        .filter(p => namesLC.includes((p.name || '').trim().toLowerCase()))
        .map(p => p.id)
      const kIds = Array.from(new Set([...fromHistory, ...fromNames]))
      setKeeperIds(kIds)

      // generer plan
      const generated = generatePlan({
        playerIds: ps.map(p => p.id),
        keeperIds: kIds,
        onFieldCount: m.onFieldCount,
        halves: m.halves,
        halfLengthMin: m.halfLengthMin,
        subIntervalMin: m.subIntervalMin,
        keeperRarity: m.keeperRarity,
        keeperIntervalMin: m.keeperIntervalMin,
        historyMinutes: Object.fromEntries(hist.map(h => [h.playerId, h.rollingMinutes])),
      })

      await db.plans.put({ id: matchId, matchId, windows: generated.windows })
      setPlan({ ...generated, windows: generated.windows })
    })()
  }, [matchId])

  const nameOf = (id: string) => players.find(p => p.id === id)?.name || ''

  // hjelpefunksjoner for keeper-logikk og startoppsett
  const isKeeperMinute = (min: number) => {
    if (!match) return false
    if (match.keeperIntervalMin && match.keeperIntervalMin > 0) return min % match.keeperIntervalMin === 0
    if (match.subIntervalMin && match.keeperRarity && match.keeperRarity > 0) {
      const winIdx = Math.floor(min / match.subIntervalMin) - 1
      return winIdx >= 0 && winIdx % match.keeperRarity === match.keeperRarity - 1
    }
    return false
  }

  const computeStartLineup = (onField: number, allPlayers: Player[], kIds: string[]) => {
    const active: string[] = []
    const k = kIds.find(id => allPlayers.some(p => p.id === id))
    if (k) active.push(k)
    for (const p of allPlayers) {
      if (active.length >= onField) break
      if (!active.includes(p.id)) active.push(p.id)
    }
    return active.slice(0, onField)
  }

  const ensureKeeperAndFill = (activeIn: string[], onField: number, isKeeperWindow: boolean) => {
    let active = [...activeIn]

    if (isKeeperWindow && keeperIds.length > 0) {
      const hasKeeper = active.some(id => keeperIds.includes(id))
      if (!hasKeeper) {
        const benchKeeper = players.map(p => p.id).find(id => keeperIds.includes(id) && !active.includes(id))
        if (benchKeeper) {
          if (active.length >= onField) {
            const replaceIdx = [...active].reverse().findIndex(id => !keeperIds.includes(id))
            const realIdx = replaceIdx === -1 ? active.length - 1 : active.length - 1 - replaceIdx
            active[realIdx] = benchKeeper
          } else {
            active.push(benchKeeper)
          }
        }
      }
    }

    if (active.length < onField) {
      const bench = players.map(p => p.id).filter(id => !active.includes(id))
      for (const id of bench) {
        active.push(id)
        if (active.length >= onField) break
      }
    }
    return active.slice(0, onField)
  }

  // bygg lineups for visning
  useEffect(() => {
    if (!plan || !match || players.length === 0) return

    const start = computeStartLineup(match.onFieldCount, players, keeperIds)
    setStartLineup(start)

    const out: string[][] = []
    let active = [...start]
    for (const w of plan.windows) {
      active = active.filter((id: string) => !w.outs.includes(id))
      for (const id of w.ins) if (!active.includes(id)) active.push(id)
      active = ensureKeeperAndFill(active, match.onFieldCount, isKeeperMinute(w.minute))
      out.push([...active])
    }
    setLineupsAfterWindow(out)
  }, [plan, match, players, keeperIds])

  if (!match || !plan) {
    return (
      <div className="max-w-md mx-auto p-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200">
          Laster plan…
        </div>
      </div>
    )
  }

  const keeperText =
    match.keeperIntervalMin && match.keeperIntervalMin > 0
      ? `keeper hvert ${match.keeperIntervalMin}. min`
      : match.keeperRarity
      ? `keeper hvert ${match.keeperRarity}. vindu`
      : 'keeper uten særskilt frekvens'

  const splitKeeper = (ids: string[]) => {
    const k = ids.find(id => keeperIds.includes(id))
    const fielders = ids.filter(id => id !== k)
    return { keeper: k, fielders }
  }

  return (
    <div className="max-w-md mx-auto mt-6 px-3">
      {/* Headerkort */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-100">Plan for kamp</h1>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => nav(`/live/${matchId}`)}>Send til Live</button>
          </div>
        </div>

        <p className="text-slate-400 mt-2">
          {match.sport} · {match.halves}×{match.halfLengthMin} min · bytte hver {match.subIntervalMin} min · {keeperText}
        </p>

        {/* Startoppsett */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-slate-300 font-medium">T=0:00 – Startoppsett</div>
          <div className="mt-2 text-sm text-slate-300">
            {(() => {
              const { keeper, fielders } = splitKeeper(startLineup)
              return (
                <>
                  {keeper && (
                    <div className="flex gap-2 items-center">
                      <span className="text-slate-400">Keeper:</span>
                      <span>{nameOf(keeper)}</span>
                    </div>
                  )}
                  <div className="flex gap-2 items-start">
                    <span className="text-slate-400">Utespillere:</span>
                    <span>{fielders.map(id => nameOf(id)).filter(Boolean).join(', ') || '—'}</span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Vinduer */}
      <ul className="mt-4 space-y-3">
        {plan.windows.map((w: any, idx: number) => {
          const after = lineupsAfterWindow[idx] || []
          const { keeper, fielders } = splitKeeper(after)
          return (
            <li key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-slate-100 font-semibold">T={w.minute}:00</div>
                {isKeeperMinute(w.minute) && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-600/20 text-blue-300 border border-blue-600/30">
                    Keeper-vindu
                  </span>
                )}
              </div>

              <div className="mt-2 text-sm text-slate-300">
                <div><span className="text-slate-400">INN:</span> {w.ins.map((id: string) => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
                <div><span className="text-slate-400">UT:</span> {w.outs.map((id: string) => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
              </div>

              <div className="mt-3">
                <div className="text-slate-400 text-sm italic">Line-up etter byttet:</div>
                <div className="mt-1 text-sm text-slate-300 space-y-1">
                  {keeper && (
                    <div><span className="text-slate-400">Keeper:</span> {nameOf(keeper)}</div>
                  )}
                  <div><span className="text-slate-400">Utespillere:</span> {fielders.map(id => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Navigasjon */}
      <div className="mt-5 flex gap-2">
        <button className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
          onClick={() => nav(`/live/${matchId}`)}>
          Gå til Live
        </button>
        <Link to="/" className="px-4 h-12 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center">
          Til hjem
        </Link>
      </div>
    </div>
  )
}
