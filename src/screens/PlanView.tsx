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

  useEffect(()=>{
    (async ()=>{
      const m = await db.matches.get(matchId!)
      if (!m) return
      setMatch(m)

      const ps = await db.players.where('teamId').equals(m.teamId).toArray()
      setPlayers(ps)

      const history = await db.history.where('playerId').anyOf(ps.map(p=>p.id)).toArray()
      const keeperIdsFromHistory = history.filter(h=>h.lastPosition==='keeper').map(h=>h.playerId)

      // Hent keepere også fra keeperNamesRaw (kommaseparert), men vi bruker dem kun for plan-generatoren
      const namesLC = (m.keeperNamesRaw ?? '').split(/[,\n;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean)
      const keeperIdsFromNames = ps.filter(p => namesLC.includes((p.name||'').trim().toLowerCase())).map(p => p.id)
      const keeperIds = Array.from(new Set([...keeperIdsFromHistory, ...keeperIdsFromNames]))

      const generated = generatePlan({
        playerIds: ps.map(p=>p.id),
        keeperIds,
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

  // Keeper-vindu (badgen) styres av tid, ikke av hvem som er keeper
  const isKeeperMinute = (min: number) => {
    if (!match) return false
    if (match.keeperIntervalMin && match.keeperIntervalMin > 0) {
      return (min % match.keeperIntervalMin) === 0
    }
    if (match.keeperRarity && match.keeperRarity > 0) {
      const windowIndex = Math.floor(min / match.subIntervalMin) - 1
      return windowIndex >= 0 && (windowIndex % match.keeperRarity) === (match.keeperRarity - 1)
    }
    return false
  }

  const nameOf = (id: string) => players.find(pl => pl.id === id)?.name || ''

  if (!match || !plan) return <div className="card">Laster plan…</div>

  const keeperText =
    match.keeperIntervalMin && match.keeperIntervalMin > 0
      ? `keeper hvert ${match.keeperIntervalMin}. min`
      : match.keeperRarity
        ? `keeper hvert ${match.keeperRarity}. vindu`
        : 'keeper uten særskilt frekvens'

  return (
    <div className="grid">
      <div className="card">
        <h2>Plan for kamp</h2>

        <p className="muted">
          {match.sport} · {match.halves}×{match.halfLengthMin} min · bytte hver {match.subIntervalMin} min ·{' '}
          {keeperText}
        </p>

        <ul className="list">
          {plan.windows.map((w: any, idx: number) => (
            <li key={idx} style={{ marginBottom: 8 }}>
              <div className="card">
                <strong>
                  T={w.minute}:00{' '}
                  {isKeeperMinute(w.minute) && <span className="pill">Keeper-vindu</span>}
                </strong>
                <div>INN: {w.ins.map((id: string) => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
                <div>UT: {w.outs.map((id: string) => nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
              </div>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => nav(`/live/${matchId}`)}>Send til Live</button>
          <Link to="/"><button>Til hjem</button></Link>
        </div>
      </div>
    </div>
  )
}
