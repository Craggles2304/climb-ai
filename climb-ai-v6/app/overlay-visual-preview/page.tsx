import type {Metadata} from 'next';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const metadata:Metadata={
  title:'OP CLIMB · Esports HUD Visual Review',
  description:'Visual comparison of the real Companion in-game HUD styling. Illustration only, not connected to a match.',
  robots:{index:false,follow:false},
};
export const dynamic='force-static';

const fixture={
  champion:'Jinx',
  role:'ADC',
  mission:'Before every teamfight, identify the nearest safe target and keep an escape route.',
  win:'Play front-to-back with your support; keep damaging the nearest safe target.',
  avoid:'Do not walk into an unwarded river alone.',
  threat:'Their engage champions will try to reach the back line.',
  actions:[
    'Track the wave before your first recall',
    'Move with your support when the wave is safe',
    'Attack the nearest safe target, then reset with the team',
  ],
};

function previewHtml(mode:'MINIMAL'|'FOCUS'|'EXPANDED'){
  const directory=join(process.cwd(),'companion','electron');
  const html=readFileSync(join(directory,'learning-overlay.html'),'utf8');
  const styles=['arena-tokens.css','design-system.css','learning-overlay.css','learning-overlay-esports.css']
    .map(file=>readFileSync(join(directory,file),'utf8')).join('\n');

  const changes:[
    string,string
  ][]=[
    ['class="hud mode-focus"','class="hud mode-'+mode.toLowerCase()+'"'],
    ['data-mode="FOCUS"','data-mode="'+mode+'"'],
    ['id="modeIndicator">FOCUS','id="modeIndicator">'+mode],
    ['id="status">LEAGUE RECORDING','id="status">LAYOUT DEMO'],
    ['id="game" class="hud-kicker">LEAGUE OF LEGENDS','id="game" class="hud-kicker">LEAGUE OF LEGENDS'],
    ['id="title">Your match focus','id="title">'+fixture.champion+' · '+fixture.role],
    ['id="planState">PRE-GAME PLAN','id="planState">STATIC EXAMPLE'],
    ['id="mission"></p>','id="mission">'+fixture.mission+'</p>'],
    ['id="win"></p>','id="win">'+fixture.win+'</p>'],
    ['id="avoid"></p>','id="avoid">'+fixture.avoid+'</p>'],
    ['id="threat"></p>','id="threat">'+fixture.threat+'</p>'],
    ['id="actions"></ol>','id="actions">'+fixture.actions.map(v=>'<li>'+v+'</li>').join('')+'</ol>'],
    ['id="recordingStatus" class="hud-rec">● TRACKING ACTIVE','id="recordingStatus" class="hud-rec">● PREVIEW ONLY'],
    ['id="championArt" src="" alt="" hidden','id="championArt" src="https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/Jinx_0.jpg" alt=""'],
    ['id="championFallback" aria-hidden="true">OP','id="championFallback" aria-hidden="true" hidden>OP'],
  ];

  let document=html
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i,'')
    .replace(/<link rel="stylesheet"[^>]*>/gi,'')
    .replace(/<script src="[^"]+"><\/script>/gi,'');
  for(const [from,to] of changes)document=document.replace(from,to);
  const demoStyle=`<style>
    ${styles}
    html,body{width:100%;height:100%;overflow:hidden!important;background:transparent!important;}
    .hud{position:relative!important;top:auto!important;left:auto!important;max-width:100%!important;
         opacity:1!important;transform:none!important;margin:0!important}
    body{padding:0!important;min-height:0!important}
    </style>`;
  return document.replace('</head>',demoStyle+'</head>');
}

const presets=[
  {mode:'MINIMAL' as const,title:'01 · MINIMAL',purpose:'One mission. Almost no distraction.',height:150},
  {mode:'FOCUS' as const,title:'02 · FOCUS',purpose:'Champion, mission and locked win condition.',height:350},
  {mode:'EXPANDED' as const,title:'03 · EXPANDED',purpose:'Full pre-game plan when you want more context.',height:620},
];

export default function OverlayVisualPreview(){
  return <main style={{
    color:'#eff9f6',minHeight:'100vh',fontFamily:'system-ui,Segoe UI,sans-serif',
    background:'radial-gradient(ellipse 110% 70% at 70% 0%,#1c3a46,transparent 62%),#060b12',
    padding:'min(6vw,54px) 22px',
  }}>
    <div style={{maxWidth:1250,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap',marginBottom:30}}>
        <div>
          <span style={{display:'block',color:'#baff5a',fontSize:11,letterSpacing:'.17em',fontWeight:900,marginBottom:12}}>OP CLIMB / WINDOWS COMPANION / DESIGN REVIEW</span>
          <h1 style={{fontWeight:950,fontSize:'clamp(36px,4vw,62px)',letterSpacing:'.02em',lineHeight:1,margin:'0 0 10px'}}>THE IN-GAME ESPORTS HUD.</h1>
          <p style={{color:'#b5c7d0',maxWidth:740,margin:0,lineHeight:1.65,fontSize:14}}>These are the real Companion HUD HTML and CSS assets displayed with fictional Jinx examples. Actual player data and match tracking are not connected here.</p>
        </div>
        <a href="/original-preview" style={{color:'#07130a',background:'#baff5a',padding:'12px 16px',textDecoration:'none',fontWeight:850,fontSize:13}}>← ORIGINAL ARENA</a>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:17,alignItems:'start'}}>
        {presets.map(p=><section key={p.mode} style={{
          minWidth:0,border:'1px solid #426071',background:'#0b1420',
          padding:15,boxShadow:'0 20px 50px #0007',
        }}>
          <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:10,marginBottom:18}}>
            <div><h2 style={{fontSize:22,fontWeight:900,margin:'0 0 7px',color:'#eaf6fc'}}>{p.title}</h2>
              <p style={{fontSize:12,color:'#8ea6b8',lineHeight:1.5,margin:0}}>{p.purpose}</p></div>
            <span style={{fontSize:10,border:'1px solid #5c8d78',padding:'4px 7px',color:'#baff5a',whiteSpace:'nowrap'}}>DESIGN DEMO</span>
          </div>
          <div style={{background:'radial-gradient(circle at 85% 15%,rgba(75,110,138,.5),transparent 60%),#060c14',minHeight:p.height+20,padding:10,overflow:'hidden'}}>
            <iframe title={'OP CLIMB '+p.mode+' static HUD preview'} srcDoc={previewHtml(p.mode)}
              sandbox="" loading="lazy"
              style={{display:'block',width:'100%',height:p.height,border:0,background:'transparent'}}/>
          </div>
          <p style={{color:'#8fa9b7',fontSize:11,lineHeight:1.5,margin:'14px 0 0'}}>In Windows, this HUD floats over borderless or windowed League. It becomes click-through when you finish editing its position.</p>
        </section>)}
      </div>
      <aside style={{marginTop:23,padding:'16px 18px',border:'1px solid #365d67',borderLeft:'3px solid #baff5a',background:'#0d1c29',color:'#b7cedb',fontSize:13,lineHeight:1.6}}>
        <strong style={{color:'#d9ffbe'}}>GAMEPLAY SAFETY:</strong> These panels display only an agreed pre-game mission and static win condition. No live enemy scouting, automatic mission completion or real-time shotcalling.
        An updated Windows Companion installer is required to release the design to players.
      </aside>
    </div>
  </main>;
}
