import { Link } from 'react-router-dom'
import { db } from '@/db/schema'
import React from 'react'

export default function Home(){
  const [matches, setMatches] = React.useState<any[]>([])
  React.useEffect(()=>{
    db.matches.orderBy('createdAt').reverse().limit(10).toArray().then(setMatches)
  },[])
  return (
    <div className="grid">
      <div className="card">
        <h2>Ny kamp</h2>
        <p className="muted">Start en ny kamp med spillere og bytteoppsett.</p>
        <Link to="/setup"><button className="btn">Oppsett</button></Link>
      </div>
      <div className="card">
        <h2>Siste kamper</h2>
        <ul className="list">
          {matches.length ? matches.map(m => (
            <li key={m.id}>
              <Link to={`/plan/${m.id}`}>{m.sport} · {new Date(m.createdAt).toLocaleString()}</Link>
            </li>
          )) : <li>Ingen kamper ennå.</li>}
        </ul>
      </div>
    </div>
  )
}
