import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import { useParams, useNavigate } from 'react-router-dom'
import { useTimer } from '@/hooks/useTimer'

export default function LiveView(){
  const { matchId } = useParams()
  const nav = useNavigate()
  const { sec, running, start, pause, reset } = useTimer(0)

  const [players, setPlayers] = useState<any[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [match, setMatch] = useState<any>(null)
  const [windowIdx, setWindowIdx] = useState(0)

  useEffect(()=>{
    (async ()=>{
      const m = await db.matches.get(matchId!)
      if (!m) return
      setMatch(m)

      const ps = await db.players.where('teamId').equals(m.teamId).toArray()
      setPlayers(ps)

      const pl = await db.plans.get(matchId!)
      setPlan(pl)
    })()
  },[matchId])

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

  const nameOf = (id: string) => {
    const p = players.find(pl => pl.id === id)
    return p ? p.name : ''
  }

  useEffect(()=>{
    if (!match || !plan) return
    const minutes = Math.floor(sec/60)
    const idx = plan.windows.findIndex((w: any)=> w.minute > minutes)
    setWindowIdx(idx === -1 ? Math.max(0, plan.windows.length - 1) : idx)
  },[sec, match, plan])

  if (!match || !plan) return <div className="card">Laster…</div>
  const next = plan.windows[windowIdx]

  return (
    <div className="grid">
      <div className="card">
        <h2>Live</h2>

        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <div>Tid: {Math.floor(sec/60).toString().padStart(2,'0')}:{Math.floor(sec%60).toString().padStart(2,'0')}</div>
          {!running ? <button className="btn" onClick={start}>Start</button> : <button onClick={pause}>Pause</button>}
          <button onClick={reset}>Nullstill</button>
        </div>

        <p className="muted" style={{marginTop:8}}>
          Neste vindu: T={next?.minute}:00{' '}
          {next && isKeeperMinute(next.minute) && <span className="pill">Keeper-vindu</span>}
        </p>

        <div className="card">
          <div><strong>INN:</strong> {next?.ins.map((id:string)=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
          <div><strong>UT:</strong> {next?.outs.map((id:string)=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>

          <div style={{marginTop:8, display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn" onClick={()=>setWindowIdx(Math.min(windowIdx+1, plan.windows.length-1))}>Bytt nå</button>
            <button onClick={()=>setWindowIdx(Math.max(0, windowIdx-1))}>Tilbake</button>
          </div>
        </div>

        <div style={{marginTop:12}}>
          <button onClick={()=>nav(`/summary/${matchId}`)}>Avslutt kamp</button>
        </div>
      </div>
    </div>
  )
}
