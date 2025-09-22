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
      const keeperIds = history.filter(h=>h.lastPosition==='keeper').map(h=>h.playerId)
      const plan = generatePlan({
        playerIds: ps.map(p=>p.id),
        keeperIds,
        onFieldCount: m.onFieldCount,
        halves: m.halves,
        halfLengthMin: m.halfLengthMin,
        subIntervalMin: m.subIntervalMin,
        keeperRarity: m.keeperRarity,
        historyMinutes: Object.fromEntries(history.map(h=>[h.playerId, h.rollingMinutes]))
      })
      await db.plans.put({ id: matchId!, matchId: matchId!, windows: plan.windows })
      setPlan({ ...plan, windows: plan.windows })
    })()
  }, [matchId])

  if (!match || !plan) return <div className="card">Laster plan…</div>

  return (
    <div className="grid">
      <div className="card">
        <h2>Plan for kamp</h2>
        <p className="muted">{match.sport} · {match.halves}×{match.halfLengthMin} min · bytte hver {match.subIntervalMin} min</p>
        <ul className="list">
          {plan.windows.map((w:any, idx:number)=> (
            <li key={idx} style={{marginBottom:8}}>
              <div className="card">
                <strong>T={w.minute}:00</strong>
                <div>INN: {w.ins.map((id:string)=>players.find(p=>p.id===id)?.name).filter(Boolean).join(', ') || '—'}</div>
                <div>UT: {w.outs.map((id:string)=>players.find(p=>p.id===id)?.name).filter(Boolean).join(', ') || '—'}</div>
              </div>
            </li>
          ))}
        </ul>
        <div style={{marginTop:12, display:'flex', gap:8}}>
          <button className="btn" onClick={()=>nav(`/live/${matchId}`)}>Send til Live</button>
          <Link to="/"><button>Til hjem</button></Link>
        </div>
      </div>
    </div>
  )
}
