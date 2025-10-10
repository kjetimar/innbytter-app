import { useEffect, useMemo, useState } from 'react'
import { db } from '@/db/schema'
import { useParams, useNavigate } from 'react-router-dom'
import { useTimer } from '@/hooks/useTimer'

type ViewTab = 'plan' | 'lineup'

export default function LiveView(){
  const { matchId } = useParams()
  const nav = useNavigate()
  const { sec, running, start, pause, reset } = useTimer(0)

  const [players, setPlayers] = useState<any[]>([])
  const [match, setMatch] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [windowIdx, setWindowIdx] = useState(0)

  // score
  const [ourScore, setOurScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)

  // skader/deaktiver
  const [disabledIds, setDisabledIds] = useState<string[]>([])

  // keeperliste
  const [keeperIds, setKeeperIds] = useState<string[]>([])

  // lineup nå
  const [lineup, setLineup] = useState<string[]>([])

  // UI: toggle
  const [tab, setTab] = useState<ViewTab>('lineup')

  // ───────────── INIT: hent kamp/ spillere/ plan/ keepere ─────────────
  useEffect(()=>{
    (async ()=>{
      const m = await db.matches.get(matchId!)
      if (!m) return
      setMatch(m)

      const ps = await db.players.where('teamId').equals(m.teamId).toArray()
      setPlayers(ps)

      const hist = await db.history.where('playerId').anyOf(ps.map(p=>p.id)).toArray()
      const fromHistory = hist.filter(h=>h.lastPosition==='keeper').map(h=>h.playerId)
      const namesLC = (m.keeperNamesRaw ?? '').split(/[,\n;]+/).map((s:string)=>s.trim().toLowerCase()).filter(Boolean)
      const fromNames = ps.filter(p => namesLC.includes((p.name||'').trim().toLowerCase())).map(p => p.id)
      setKeeperIds(Array.from(new Set([...fromHistory, ...fromNames])))

      const pl = await db.plans.get(matchId!)
      setPlan(pl)
    })()
  },[matchId])

  const nameOf = (id: string) => players.find(pl => pl.id === id)?.name || ''

  // ───────────── Ekstra spillere: +1 per 4 mål under ─────────────
  const extraPlayers = useMemo(()=>{
    const diff = oppScore - ourScore
    return diff > 0 ? Math.floor(diff / 4) : 0
  }, [ourScore, oppScore])

  const effectiveOnFieldCount = useMemo(()=>{
    if (!match) return 0
    return match.onFieldCount + extraPlayers
  },[match, extraPlayers])

  // ───────────── Keeper-vindu ─────────────
  const isKeeperMinute = (min: number) => {
    if (!match) return false
    if (match.keeperIntervalMin && match.keeperIntervalMin > 0) return (min % match.keeperIntervalMin) === 0
    if (match.keeperRarity && match.keeperRarity > 0) {
      const winIdx = Math.floor(min / match.subIntervalMin) - 1
      return winIdx >= 0 && (winIdx % match.keeperRarity) === (match.keeperRarity - 1)
    }
    return false
  }

  // ───────────── Startoppsett ─────────────
  const computeStartLineup = (onField: number) => {
    const active: string[] = []
    const keeperOnRoster = keeperIds.find(id => players.some(p => p.id === id))
    if (keeperOnRoster) active.push(keeperOnRoster)
    for (const p of players) {
      if (active.length >= onField) break
      if (!active.includes(p.id)) active.push(p.id)
    }
    return active.slice(0, onField)
  }

  // ───────────── Fyll/keeper-sikring ─────────────
  const ensureKeeperAndFill = (activeIn: string[], onField: number, forceKeeper: boolean, disabledList: string[]) => {
    let active = activeIn.filter(id => !disabledList.includes(id)) // 1) fjern deaktiverte

    // 2) Sørg for keeper ved keeper-vindu
    if (forceKeeper && keeperIds.length > 0) {
      const hasKeeper = active.some(id => keeperIds.includes(id))
      if (!hasKeeper) {
        const benchKeeper = players
          .map(p=>p.id)
          .find(id => keeperIds.includes(id) && !active.includes(id) && !disabledList.includes(id))
        if (benchKeeper) {
          if (active.length >= onField) {
            // bytt ut siste utespiller
            const replaceIdx = [...active].reverse().findIndex(id => !keeperIds.includes(id))
            const realIdx = replaceIdx === -1 ? active.length - 1 : active.length - 1 - replaceIdx
            active[realIdx] = benchKeeper
          } else {
            active.push(benchKeeper)
          }
        }
      }
    }

    // 3) Fyll opp til onField
    if (active.length < onField) {
      const bench = players.map(p=>p.id).filter(id => !active.includes(id) && !disabledList.includes(id))
      for (const id of bench) {
        active.push(id)
        if (active.length >= onField) break
      }
    }

    return active.slice(0, onField)
  }

  // ───────────── Finn nåværende vindu ─────────────
  useEffect(()=>{
    if (!match || !plan) return
    const minutes = Math.floor(sec/60)
    const idx = plan.windows.findIndex((w: any)=> w.minute > minutes)
    setWindowIdx(idx === -1 ? Math.max(0, plan.windows.length - 1) : idx)
  },[sec, match, plan])

  // ───────────── Simulér lineup frem til nå ─────────────
  useEffect(()=>{
    if (!match || !plan || players.length===0) return
    let active: string[] = computeStartLineup(effectiveOnFieldCount)

    for (let i=0; i<=windowIdx && i<plan.windows.length; i++){
      const w = plan.windows[i]
      // planlagte bytter
      active = active.filter(id => !w.outs.includes(id))
      for (const id of w.ins) if (!active.includes(id)) active.push(id)
      // sikring/utfylling per vindu
      active = ensureKeeperAndFill(active, effectiveOnFieldCount, isKeeperMinute(w.minute), disabledIds)
    }

    // slutt-sikring etter at alle vinduer til nå er tatt
    active = ensureKeeperAndFill(active, effectiveOnFieldCount, false, disabledIds)
    setLineup(active)
  },[match, plan, players, windowIdx, disabledIds, effectiveOnFieldCount, keeperIds])

  // ───────────── Manuelle bytter ─────────────
  const [manualIn, setManualIn] = useState<string>('')
  const [manualOut, setManualOut] = useState<string>('')

  const benchIds = useMemo(()=>{
    const allIds = players.map(p=>p.id)
    return allIds.filter(id => !lineup.includes(id) && !disabledIds.includes(id))
  },[players, lineup, disabledIds])

  const handleManualSwap = () => {
    if (!manualIn || !manualOut) return
    setLineup(prev => {
      let next = prev.filter(id => id !== manualOut)
      if (!next.includes(manualIn)) next.push(manualIn)
      next = ensureKeeperAndFill(next, effectiveOnFieldCount, false, disabledIds)
      return next
    })
    setManualIn(''); setManualOut('')
  }

  // ───────────── Skade/deaktiver med umiddelbar erstatning ─────────────
  const toggleDisabled = (id: string) => {
    const disabling = !disabledIds.includes(id)
    const updatedDisabled = disabling
      ? [...disabledIds, id]
      : disabledIds.filter(x => x !== id)

    setDisabledIds(updatedDisabled)

    // Deaktiverer vi en spiller som er på banen? → erstatt umiddelbart
    if (disabling && lineup.includes(id)) {
      let next = lineup.filter(x => x !== id)
      const bench = players
        .map(p=>p.id)
        .filter(pid => !next.includes(pid) && !updatedDisabled.includes(pid))
      if (bench.length > 0) next.push(bench[0])
      next = ensureKeeperAndFill(next, effectiveOnFieldCount, false, updatedDisabled)
      setLineup(next)
    }
    // Ved aktivering gjør vi ingenting manuelt; useEffect tar den inn i rullering igjen.
  }

  // ───────────── Visning ─────────────
  const splitKeeper = (ids: string[]) => {
    const k = ids.find(id => keeperIds.includes(id))
    const fielders = ids.filter(id => id !== k)
    return { keeper: k, fielders }
  }

  if (!match || !plan) return <div className="card">Laster…</div>
  const next = plan.windows[windowIdx]
  const { keeper, fielders } = splitKeeper(lineup)

  return (
    <div className="grid">
      <div className="card">
        <h2>Live</h2>

        {/* Tid / kontroller */}
        <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
          <div>Tid: {Math.floor(sec/60).toString().padStart(2,'0')}:{Math.floor(sec%60).toString().padStart(2,'0')}</div>
          {!running ? <button className="btn" onClick={start}>Start</button> : <button onClick={pause}>Pause</button>}
          <button onClick={reset}>Nullstill</button>
        </div>

        {/* Score + ekstra-spillere-regel */}
        <div style={{marginTop:12}}>
          <strong>Stillingen:</strong> Oss {ourScore} – {oppScore} Motstander
          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            <button onClick={()=>setOurScore(s=>s+1)}>+ Mål oss</button>
            <button onClick={()=>setOppScore(s=>s+1)}>+ Mål motstander</button>
          </div>
          {extraPlayers > 0 && (
            <div className="muted" style={{marginTop:6}}>
              Motstander leder med {oppScore-ourScore}. Ekstra spillere aktiv: {match.onFieldCount}+{extraPlayers} (= {effectiveOnFieldCount}).
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{marginTop:12, display:'flex', gap:8}}>
          <button className={tab==='lineup'?'btn':''} onClick={()=>setTab('lineup')}>Spillere på banen</button>
          <button className={tab==='plan'?'btn':''} onClick={()=>setTab('plan')}>Bytteplan</button>
        </div>

        {/* Innhold */}
        {tab==='lineup' ? (
          <div style={{marginTop:12}}>
            <strong>Line-up nå ({effectiveOnFieldCount} på banen):</strong>
            <div style={{marginTop:6}}>
              {keeper && <div><em>Keeper:</em> {nameOf(keeper)}</div>}
              <div><em>Utespillere:</em> {fielders.map(id=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
            </div>

            {/* Manuelle bytter */}
            <div className="card" style={{marginTop:12}}>
              <strong>Manuelt bytte (overstyring)</strong>
              <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
                <span>UT:</span>
                <select value={manualOut} onChange={e=>setManualOut(e.target.value)}>
                  <option value="">— velg —</option>
                  {lineup.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
                <span>INN:</span>
                <select value={manualIn} onChange={e=>setManualIn(e.target.value)}>
                  <option value="">— velg —</option>
                  {benchIds.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
                <button className="btn" onClick={handleManualSwap} disabled={!manualIn || !manualOut}>Utfør manuelt bytte</button>
              </div>

              {/* Skade/deaktiver */}
              <div style={{marginTop:12}}>
                <strong>Deaktiver spillere (skade):</strong>
                <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop:6}}>
                  {players.map(p=>(
                    <label key={p.id} style={{display:'flex', gap:4, alignItems:'center'}}>
                      <input type="checkbox" checked={disabledIds.includes(p.id)} onChange={()=>toggleDisabled(p.id)} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{marginTop:12}} className="card">
            <p className="muted">Neste vindu: T={next?.minute}:00</p>
            <div><strong>INN:</strong> {next?.ins.map((id:string)=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
            <div><strong>UT:</strong> {next?.outs.map((id:string)=>nameOf(id)).filter(Boolean).join(', ') || '—'}</div>
            <div style={{marginTop:8, display:'flex', gap:8, flexWrap:'wrap'}}>
              <button className="btn" onClick={()=>setWindowIdx(i=>Math.min(i+1, plan.windows.length-1))}>Bytt nå</button>
              <button onClick={()=>setWindowIdx(i=>Math.max(0, i-1))}>Tilbake</button>
            </div>
          </div>
        )}

        <div style={{marginTop:12}}>
          <button onClick={()=>nav(`/summary/${matchId}`)}>Avslutt kamp</button>
        </div>
      </div>
    </div>
  )
}
