import type {Metadata} from 'next';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const metadata:Metadata={
  title:'OP CLIMB · Champion Select Draft Advisor Preview',
  description:'Illustration of the real OP CLIMB Companion Best Pick and draft-index components, with fictional champions.',
  robots:{index:false,follow:false},
};
export const dynamic='force-static';

function nativePreview(confidence:'FORMING'|'PARTIAL'|'FULL'){
  const root=join(process.cwd(),'companion','electron');
  const css=['arena-tokens.css','design-system.css','draft.css','draft-advisor.css']
    .map(file=>readFileSync(join(root,file),'utf8')).join('\n');
  const scripts=['oc-ui.js','draft-advisor-view.js'].map(file=>readFileSync(join(root,file),'utf8'));
  const model={
    available:true,role:'ADC',patch:'DEMO',locked:false,considered:25,
    known:confidence==='FORMING'?{allies:1,enemies:0}:confidence==='PARTIAL'?{allies:3,enemies:3}:{allies:5,enemies:5},
    recommended:[
      {champion:'Jinx',score:79,reason:['Adds sustained damage behind your frontline','Fits your existing protection']},
      {champion:'Ashe',score:75,reason:['Offers follow-up engage and utility']},
      {champion:'Caitlyn',score:69,reason:['Provides long-range lane pressure']},
    ],
    edge:{ours:confidence==='FORMING'?50:confidence==='PARTIAL'?54:56,
      theirs:confidence==='FORMING'?50:confidence==='PARTIAL'?46:44,
      confidence,label:'DRAFT ADVANTAGE INDEX · NOT VERIFIED WIN ODDS'},
  };
  const fixture=JSON.stringify({draft:{localLockedIn:false},draftAdvice:model}).replace(/</g,'\\u003c');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"/><style>'+
    css+'html,body{background:#08121d;color:#edf6fa;margin:0;padding:0;overflow-x:hidden}'+
    '.preview{padding:6px;max-width:100%}.oc-pick-advisor{box-sizing:border-box;width:100%}'+
    '</style></head><body class="oc-app"><main id="root" class="preview"></main>'+
    '<script>'+scripts[0]+'</script><script>'+scripts[1]+'</script>'+
    '<script>var example='+fixture+';document.getElementById("root").innerHTML=window.ocDraftAdvisor.render(example);</script>'+
    '</body></html>';
}

const scenarios=[
  {id:'FORMING' as const,title:'01 · EARLY DRAFT',body:'Not enough enemy information; the bar deliberately stays neutral.'},
  {id:'PARTIAL' as const,title:'02 · PICKS REVEALED',body:'Recommendations adjust to revealed allies, enemies and bans.'},
  {id:'FULL' as const,title:'03 · FINAL COMPOSITION',body:'A bounded composition index once the draft is visible; still not true win odds.'},
];

export default function CompanionDraftAdvisorPreview(){
  return <main style={{minHeight:'100vh',background:'radial-gradient(ellipse at 85% 0%,#1b3e46,transparent 48%),#060c15',color:'#eef9f7',fontFamily:'system-ui,Segoe UI,sans-serif',padding:'40px clamp(16px,4vw,50px)'}}>
    <section style={{maxWidth:1400,margin:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:20,alignItems:'center',marginBottom:24}}>
        <div>
          <div style={{color:'#c5ff7b',fontSize:11,fontWeight:900,letterSpacing:'.16em',marginBottom:9}}>OP CLIMB / WINDOWS COMPANION / DESIGN REVIEW</div>
          <h1 style={{fontSize:'clamp(32px,4.8vw,58px)',margin:'0 0 10px',lineHeight:1}}>LIVE CHAMPION SELECT ADVISOR</h1>
          <p style={{color:'#b3c8d0',fontSize:14,lineHeight:1.7,maxWidth:770}}>This preview renders the real Companion advisor component with <strong>fictional examples</strong>. It does not connect to your League client, contain live draft data, or predict match outcomes.</p>
        </div>
        <a href="/missions" style={{background:'#c7ff7a',color:'#0a1916',textDecoration:'none',fontWeight:850,fontSize:12,padding:'12px 16px'}}>BACK TO OP CLIMB →</a>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,420px),1fr))',gap:20,alignItems:'start'}}>
        {scenarios.map(s=><article key={s.id} style={{minWidth:0,border:'1px solid #30545c',padding:10,background:'#101c2a'}}>
          <div style={{padding:'8px 8px 13px'}}><strong style={{fontSize:16,color:'#c3fc83'}}>{s.title}</strong><p style={{color:'#b4c8d6',fontSize:12,lineHeight:1.5,margin:'8px 0 0'}}>{s.body}</p></div>
          <iframe title={s.title} sandbox="allow-scripts" scrolling="no" srcDoc={nativePreview(s.id)}
            style={{width:'100%',height:590,border:0,background:'#08121d'}}/>
        </article>)}
      </div>
      <p style={{fontSize:12,color:'#c4b7a5',marginTop:24}}>Estimates here compare draft composition characteristics only. Reliable real win probabilities require a separately calibrated, sufficiently sampled match-outcome dataset by patch, rank and draft context.</p>
    </section>
  </main>;
}
