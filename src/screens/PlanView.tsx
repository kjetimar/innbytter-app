import { useEffect, useState } from 'react'
import { db, Player } from '@/db/schema'
import { generatePlan } from '@/domain/planner'
import { Link, useParams, useNavigate } from 'react-router-dom'

export default function PlanView(){
  const { matchId } = useParams()
  const nav = useNavigate()
  const [plan, setPlan] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [match, setMatch] = useState<any>(null)

  const [startLineup, setStartLineup] = useState<string[]>([])
  const [lineupsAfterWindow, setLineupsAfterWindow] = useState<string[][]>([])
  const [keeperIds, setKeeperIds] = useState<string[]>([])

  useEffect(()=>{
    (async ()=>{
      const m = await db.matches.get(matchId!)
      if (!m) return
      setMatch(m)

      const ps = await db.players.where('teamId').equals(m.teamId).toArray()
      setPlayers(ps)

      const history = await db.history.where('playerId').anyOf(ps.map(p=>p.id)).toArray()
      const fromHistory = history.filter(h=>h.lastPosition==='keeper').map(h=>h.playerId)
      const namesLC = (m.keeperNamesRaw ?? '').split(/[,\n;]+/).map((s:string)=>s.trim().toLowerCase()).filter(Boolean)
      const fromNames = ps.filter(p => namesLC.includes((p.name||'').trim().toLowerCase())).map(p => p.id)
      const kIds = Array.from(new Set([...fromHistory, ...fromNames]))
      setKeeperIds(kIds)

      const generated = generatePlan({
        playerIds: ps.map(p=>p.id),
        keeperIds: kIds,
        onFieldCount: m.onFieldCount,
        halves: m.halves,
        halfLengthMin: m.halfLengthMin,
        subIntervalMin: m.subIntervalMin,
        keeperRarity: m.keeperRarity,
        keeperIntervalMin: m.keeperIntervalMin,
        historyMinutes: Object.fromEntries(history.map(h=>[h.playerId, h.rollingMinutes]))
      })

      await db.plans.put({ id: matchId!, matchId: matchId!, windows: generated.windows })
      setPlan({ ...generated, windows: generated.windows })
    })()
  }, [matchId])

  const nameOf = (id: string) => players.find(pl => pl.id === id)?.name || ''

  const isKeeperMinute = (min: number) => {
    if (!match) return false
    if (match.keeperIntervalMin && match.keeperIntervalMin > 0) return (min % match.keeperIntervalMin) === 0
    if (match.keeperRarity && match.keeperRarity > 0) {
      const winIdx = Math.floor(min / match.subIntervalMin) - 1
      return winIdx >= 0 && (winIdx % match.keeperRarity) === (match.keeperRarity - 1)
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
        const benchKeeper = players
          .map(p=>p.id)
          .find(id => keeperIds.includes(id) && !active.includes(id))
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
      const bench = players.map(p=>p.id).filter(id => !active.includes(id))
      for (const id of bench) {
        active.push(id)
        if (active.length >= onField) break
      }
    }
    return active.slice(0, onField)
  }

  useEffect(()=>{
    if (!plan || !match || players.length===0) return

    const start = computeStartLineup(match.onFieldCount, players, keeperIds)
    setStartLineup(start)

    const out: string[][] = []
    let active = [...start]
    for (const w of plan.windows){
      active = active.filter((id:string)=>!w.outs.includes(id))
      for (const id of w.ins) if (!active.includes(id)) active.push(id)
      active = ensureKeeperAndFill(active, match.onFieldCount, isKeeperMinute(w.minute))
      out.push(active)
    }
    setLineupsAfterWindow(out)
  },[plan, match, players, keeperIds])

  if (!match || !plan) return <div className="card">Laster plan…</div>

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
    <div className="grid">
      <div className="card">
        <h2>Plan for kamp</h2>

        <p className="muted">
          {match.sport} · {match.halves}×{match.halfLengthMin} min · bytte hver {match.subIntervalMin} min · {keeperText}
        </p>

        {/* Startoppsett */}
        <div className="card" style={{marginBottom:12}}>
          <strong>T=0:00 – Startoppsett</strong>
          <div style={{marginTop:6}}>
            {(() => {
              const { keeper, fielders } = splitKeeper(startLineup)
              return (
                <>
                  {keeper && <div><em>Keeper:</em> {nameOf(keeper)}</div>}
                  <div><em>Utespillere:</em> {fielders.map(id=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
                </>
              )
            })()}
          </div>
        </div>

        <ul className="list">
          {plan.windows.map((w: any, idx: number) => {
            const after = lineupsAfterWindow[idx] || []
            const { keeper, fielders } = splitKeeper(after)
            return (
              <li key={idx} style={{ marginBottom: 8 }}>
                <div className="card">
                  <strong>
                    T={w.minute}:00{' '}
                    {isKeeperMinute(w.minute) && <span className="pill">Keeper-vindu</span>}
                  </strong>
                  <div>INN: {w.ins.map((id: string) => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
                  <div>UT: {w.outs.map((id: string) => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>

                  <div style={{ marginTop: 6 }}>
                    <em>Line-up etter byttet:</em>
                    <div style={{marginTop:4}}>
                      {keeper && <div><em>Keeper:</em> {nameOf(keeper)}</div>}
                      <div><em>Utespillere:</em> {fielders.map(id=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => nav(`/live/${matchId}`)}>Send til Live</button>
          <Link to="/"><button>Til hjem</button></Link>
        </div>
      </div>
    </div>
  )
}
