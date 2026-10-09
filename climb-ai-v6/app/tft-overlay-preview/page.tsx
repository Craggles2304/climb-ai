import type {Metadata} from 'next';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const metadata:Metadata={
 title:'OP CLIMB — TFT Tactician HUD Preview',
 description:'Review the TFT-specific Windows Companion esports overlay with the four existing preselected learning focuses.',
 robots:{index:false,follow:false},
};
export const dynamic='force-static';

const focuses=[
 {id:'ECONOMY',title:'ECONOMY DISCIPLINE',label:'Economy',rule:'Make every spend part of a plan.',cues:['Think about future options','Know your spending trade-off'],accent:'#f7cf77'},
 {id:'TEMPO',title:'BOARD TEMPO',label:'Tempo',rule:'Understand strength today versus later.',cues:['Identify your strength window','Balance strength and growth'],accent:'#7addf2'},
 {id:'FLEX',title:'FLEXIBLE GAME PLAN',label:'Flexibility',rule:'Keep more than one path available.',cues:['Recognise flexible components','Understand commitment cost'],accent:'#c5a7ff'},
 {id:'POSITION',title:'POSITIONING BASICS',label:'Positioning',rule:'Know what each unit protects.',cues:['Identify frontline purpose','Understand carry protection'],accent:'#ffa6ce'},
] as const;
type Preset='MINIMAL'|'FOCUS'|'EXPANDED';

function staticHud(focus:typeof focuses[number],mode:Preset){
 const root=join(process.cwd(),'companion','electron');
 const files=['arena-tokens.css','design-system.css','learning-overlay.css','learning-overlay-esports.css','learning-overlay-tft.css'];
 const styles=files.map(file=>readFileSync(join(root,file),'utf8')).join('\n');
 const html=readFileSync(join(root,'learning-overlay.html'),'utf8');
 let result=html
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'')
  .replace(/<link rel="stylesheet"[^>]*>/g,'')
  .replace(/<script src="[^"]+"><\/script>/g,'')
  .replace('class="hud mode-focus"','class="hud is-tft tft-focus-'+focus.id.toLowerCase()+' mode-'+mode.toLowerCase()+'"')
  .replace('data-mode="FOCUS"','data-mode="'+mode+'"')
  .replace('id="modeIndicator">FOCUS','id="modeIndicator">'+mode)
  .replace('id="hudBrandMode">PERFORMANCE HUD','id="hudBrandMode">TACTICIAN HUD')
  .replace('id="status">LEAGUE RECORDING','id="status">TFT DEMO')
  .replace('id="identityTag" class="hud-identity-tag">PLAYER / MATCH ID','id="identityTag" class="hud-identity-tag">TACTICIAN / LEARNING FOCUS')
  .replace('id="game" class="hud-kicker">LEAGUE OF LEGENDS','id="game" class="hud-kicker">TEAMFIGHT TACTICS')
  .replace('id="title">Your match focus','id="title">'+focus.title)
  .replace('id="planState">PRE-GAME PLAN','id="planState">STATIC TFT FOCUS')
  .replace('id="freezeNote" class="hud-freeze-icon">◆ FROZEN BEFORE PLAY','id="freezeNote" class="hud-freeze-icon">PRESELECTED BEFORE PLAY')
  .replace('id="ruleNote" class="hud-rule">◆ LOCKED PRE-GAME INTEL · LEARN AFTER MATCH','id="ruleNote" class="hud-rule">SELECTED BEFORE PLAY · REVIEW AFTER')
  .replace('id="missionLabel" class="hud-label">Your mission','id="missionLabel" class="hud-label">Your '+focus.label+' focus')
  .replace('id="mission"></p>','id="mission">'+focus.rule+'</p>')
  .replace('id="winLabel" class="hud-label">Win condition','id="winLabel" class="hud-label">Keep in mind')
  .replace('id="win"></p>','id="win">'+focus.cues[0]+'</p>')
  .replace('id="avoidLabel" class="hud-label">Avoid','id="avoidLabel" class="hud-label">Second reminder')
  .replace('id="avoid"></p>','id="avoid">'+focus.cues[1]+'</p>')
  .replace('id="actionsBlock" class="hud-block hud-block--actions"','id="actionsBlock" class="hud-block hud-block--actions" hidden')
  .replace('id="threatBlock" class="hud-block hud-block--threat"','id="threatBlock" class="hud-block hud-block--threat" hidden')
  .replace('id="recordingStatus" class="hud-rec">● TRACKING ACTIVE','id="recordingStatus" class="hud-rec">● DESIGN EXAMPLE')
  .replace('id="tftSigil" class="hud-tft-sigil" aria-hidden="true" hidden','id="tftSigil" class="hud-tft-sigil" aria-hidden="true"');
 result=result.replace('</head>',`<style>
 ${styles}
 html,body{width:100%;height:100%;margin:0!important;overflow:hidden!important;background:transparent!important}
 .hud{position:relative!important;top:auto!important;left:auto!important;transform:none!important;opacity:1!important;margin:0!important;max-width:100%!important}
 .hud.is-tft .hud-tft-sigil{display:grid!important}
 </style></head>`);
 return result;
}
const samples=[
 {focus:focuses[0],mode:'MINIMAL' as const,number:'01',purpose:'Smallest possible learning reminder.',height:145},
 {focus:focuses[1],mode:'FOCUS' as const,number:'02',purpose:'One focus and a supporting cue.',height:345},
 {focus:focuses[2],mode:'EXPANDED' as const,number:'03',purpose:'Two learning cues without live advice.',height:510},
 {focus:focuses[3],mode:'FOCUS' as const,number:'04',purpose:'Carry protection and formation fundamentals.',height:345},
];

export default function TftOverlayPreview(){
 return <main style={{
  minHeight:'100vh',color:'#f3eefb',fontFamily:'system-ui,Segoe UI,sans-serif',
  background:'radial-gradient(ellipse at 65% -5%,#332e56,transparent 62%),#070b17',
  padding:'min(6vw,52px) 20px',
 }}>
  <div style={{maxWidth:1250,margin:'0 auto'}}>
   <header style={{display:'flex',justifyContent:'space-between',alignItems:'start',flexWrap:'wrap',gap:22,marginBottom:30}}>
    <div>
     <span style={{display:'block',fontSize:10,color:'#e7bf7a',fontWeight:900,letterSpacing:'.16em',marginBottom:12}}>OP CLIMB / TFT / WINDOWS COMPANION</span>
     <h1 style={{fontSize:'clamp(37px,5.5vw,69px)',fontWeight:950,lineHeight:.98,margin:'0 0 11px',letterSpacing:'.025em'}}>TACTICIAN HUD.</h1>
     <p style={{color:'#b9b2d1',fontSize:14,lineHeight:1.65,maxWidth:670,margin:0}}>
      TFT now has its own esports identity: a hexagonal tactician insignia, focus-specific colours and a small overlay for preselected learning—not a League of Legends overlay with a different label.
     </p>
    </div>
    <a href="/overlay-visual-preview" style={{display:'inline-block',padding:'10px 14px',color:'#19132b',background:'#e8c682',fontWeight:900,textDecoration:'none',fontSize:12}}>COMPARE LEAGUE HUD ↗</a>
   </header>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,480px),1fr))',gap:16,alignItems:'start'}}>
    {samples.map(item=><section key={item.number} style={{minWidth:0,padding:17,border:'1px solid #564b78',background:'#0c1223',boxShadow:'0 19px 46px #0005'}}>
     <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:14,marginBottom:14}}>
      <div>
       <span style={{fontWeight:800,fontSize:10,color:item.focus.accent,letterSpacing:'.1em'}}>FOCUS {item.number} / {item.focus.label.toUpperCase()}</span>
       <h2 style={{fontWeight:950,fontSize:25,margin:'5px 0 4px',lineHeight:1.05}}>{item.focus.title}</h2>
       <p style={{color:'#9fabc4',fontSize:12,lineHeight:1.5,margin:0}}>{item.purpose}</p>
      </div>
      <span style={{whiteSpace:'nowrap',fontSize:10,border:'1px solid #695f83',padding:'6px 8px',color:'#d6c6f8'}}>{item.mode}</span>
     </div>
     <div style={{minHeight:item.height+20,padding:10,overflow:'hidden',background:'radial-gradient(ellipse at 75% 20%,#322951aa,transparent 68%),#050b14'}}>
      <iframe title={item.focus.title+' static '+item.mode+' TFT HUD'} loading="lazy" sandbox="" srcDoc={staticHud(item.focus,item.mode)}
       style={{display:'block',width:'100%',height:item.height,border:0,background:'transparent'}}/>
     </div>
     <small style={{display:'block',fontSize:11,lineHeight:1.5,color:'#978dac',marginTop:12}}>Static design preview only. Focus is selected before play and does not respond to live board state.</small>
    </section>)}
   </div>
   <p style={{border:'1px solid #5a4d7d',borderLeft:'3px solid #e8c682',background:'#15172b',padding:'16px 18px',color:'#c7bed9',lineHeight:1.6,fontSize:13,marginTop:19}}>
    <strong style={{color:'#eed6a0'}}>IMPORTANT:</strong> The real Windows overlay supports Minimal, Focus and Expanded sizes, moving, resizing and opacity controls. These previews show each size and all four existing TFT learning focuses. They do not show live gold, rolls, opponents, unit recommendations or win probabilities. A new Companion release is required before users receive the design.
   </p>
  </div>
 </main>;
}
