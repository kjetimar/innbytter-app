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
      const plan = await db.plans.get(matchId!)
      setPlan(plan)
    })()
  },[matchId])

  useEffect(()=>{
    if (!match) return
    const minutes = Math.floor(sec/60)
    const idx = Math.min(plan?.windows.findIndex((w:any)=>w.minute>minutes), (plan?.windows.length||1)-1)
    if (idx>=0) setWindowIdx(idx)
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
        <p className="muted">Neste vindu: T={next?.minute}:00</p>
        <div className="card">
          <div><strong>INN:</strong> {next?.ins.map((id:string)=>players.find(p=>p.id===id)?.name).filter(Boolean).join(', ') || '—'}</div>
          <div><strong>UT:</strong> {next?.outs.map((id:string)=>players.find(p=>p.id===id)?.name).filter(Boolean).join(', ') || '—'}</div>
          <div style={{marginTop:8}}><button className="btn" onClick={()=>setWindowIdx(Math.min(windowIdx+1, plan.windows.length-1))}>Bytt nå</button></div>
        </div>
        <div style={{marginTop:12}}>
          <button onClick={()=>nav(`/summary/${matchId}`)}>Avslutt kamp</button>
        </div>
      </div>
    </div>
  )
}
