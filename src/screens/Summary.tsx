import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import { useParams, Link } from 'react-router-dom'

export default function Summary(){
  const { matchId } = useParams()
  const [players, setPlayers] = useState<any[]>([])
  const [match, setMatch] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)

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

  if (!match || !plan) return <div className="card">Laster…</div>

  // Enkel estimering: alle på banen får minutter lik subInterval * antall vinduer de er inne.
  // (For full nøyaktighet, bruk lineupByWindow fra algoritmen og faktisk registrerte bytter.)
  return (
    <div className="card">
      <h2>Oppsummering</h2>
      <table>
        <thead><tr><th>Spiller</th><th>Planlagte min</th></tr></thead>
        <tbody>
          {players.map(p=> <tr key={p.id}><td>{p.name}</td><td>—</td></tr>)}
        </tbody>
      </table>
      <div style={{marginTop:12}}><Link to="/"><button>Til hjem</button></Link></div>
    </div>
  )
}
