'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {analyzeTftTimeline,parseTftTimeline,type TftTimeline} from '@/lib/tft/timeline';

export default function TftTimelinePage(){
  const {active}=useAccount();
  const [timeline,setTimeline]=useState<TftTimeline|null>(null);
  const [error,setError]=useState('');
  const [result,setResult]=useState<{placement:number;level:number|null;last_round:string|null;comp_signature:string|null}|null>(null);
  const findings=useMemo(()=>timeline?analyzeTftTimeline(timeline):[],[timeline]);
  useEffect(()=>{if(!timeline){setResult(null);return}let cancelled=false;void(async()=>{const client=await getBrowserClient();if(!client)return;const {data:user}=await client.auth.getUser();if(!user.user)return;const {data}=await client.from('tft_matches').select('placement,level,last_round,comp_signature').eq('user_id',user.user.id).eq('riot_account_id',active.id).eq('external_match_id',timeline.matchId).maybeSingle();if(!cancelled)setResult(data)})();return()=>{cancelled=true}},[timeline,active.id]);
  const importFile=async(file:File|undefined)=>{
    if(!file)return;
    try{setTimeline(parseTftTimeline(JSON.parse(await file.text())));setError('');}
    catch(e){setTimeline(null);setError(e instanceof Error?e.message:'Could not read timeline.');}
  };
  return <TftShell><main className="container section"><div className="eyebrow">POST-GAME DECISION TWIN</div><h1>TFT TIMELINE</h1><p className="muted" style={{maxWidth:780}}>Review local-player evidence after the game. Import a version 1 timeline from a supported recorder. Analysis stays on this device; this page does not capture live game events.</p>
    <section className="glass card" style={{marginTop:18}}><label className="btn secondary" htmlFor="tft-timeline-file">IMPORT TIMELINE JSON</label><input id="tft-timeline-file" type="file" accept="application/json,.json" onChange={e=>void importFile(e.target.files?.[0])} style={{display:'block',marginTop:12}}/>{error&&<p role="alert">{error}</p>}<p className="muted" style={{fontSize:12}}>Recorder format: version, matchId, source: local-player, points with timestamp and stage-round. Optional gold, level, XP, HP, placement, shop refresh and purchase counts, board, bench and item counts. Augment event capture is excluded pending platform approval.</p></section>
    {timeline?<><section className="glass card" style={{marginTop:18}}><div className="eyebrow">LOCAL GAME · {timeline.matchId}</div><h2>{timeline.points.length} RECORDED POINTS</h2><p className="muted">{result?`Riot post-game match linked: #${result.placement}, level ${result.level??'—'}, round ${result.last_round??'—'}, ${result.comp_signature??'board unknown'}.`:'Riot post-game match NOT OBSERVED for this account and match ID.'}</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['ROUND','GOLD','LEVEL','HP','PLACE','REFRESHES','PURCHASES','BOARD','COMPONENTS'].map(x=><th key={x} style={{padding:10}}>{x}</th>)}</tr></thead><tbody>{timeline.points.map((p,i)=><tr key={i} style={{borderTop:'1px solid rgba(255,255,255,.12)'}}>{[p.round,p.gold,p.level,p.hp,p.placement,p.shopRefreshes,p.purchases,p.boardPower,p.heldComponents].map((v,j)=><td key={j} style={{padding:10}}>{v??'—'}</td>)}</tr>)}</tbody></table></div></section><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginTop:18}}>{findings.map(f=><article className="glass card" key={f.key}><div className="eyebrow">{f.status}</div><h3>{f.title}</h3><p>{f.evidence}</p><p className="muted">{f.principle}</p></article>)}</section></>:<section className="glass card" style={{marginTop:18}}><div className="eyebrow">EVIDENCE STATUS</div><h2>NOT OBSERVED</h2><p className="muted">No local timeline has been imported. Riot post-game data remains available in <Link href="/tft/matches">match history</Link>; it cannot reconstruct every shop, roll or board change.</p></section>}
  </main></TftShell>;
}
