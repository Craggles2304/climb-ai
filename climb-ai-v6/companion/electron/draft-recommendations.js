/* OP CLIMB · draft-only champion suggestions.
 * Uses only champion picks/bans revealed by the League client and an optional
 * player-selected champion pool. Not live gameplay advice, a win-rate estimate,
 * an external meta ranking, or a claim about an unknown enemy pick.
 *
 * Browser global + Node CommonJS so the same pure engine can be tested.
 */
(function(root,build){
  'use strict';
  const api=build();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OPDraftRecommendations=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const upper=s=>String(s??'').trim().toUpperCase();
  const roles={BOTTOM:'ADC',UTILITY:'SUPPORT',MIDDLE:'MID'};
  const role=s=>roles[upper(s)]||upper(s);
  const validRoles=new Set(['TOP','JUNGLE','MID','ADC','SUPPORT']);
  const profiles=[];
  // F=frontline, E=engage, C=hard CC, P=peel, D=anti-dive,
  // T=tank shred, M=mobility, R=range, O=poke, W=waveclear,
  // S=scale, B=burst/pick, H=sustain, V=side-lane, G=ally setup.
  function add(r,damage,flags,names){
    for(const name of names.split('|'))profiles.push({name,role:r,damage,flags:new Set(flags)});
  }
  add('TOP','AP','FEC','Ornn|Malphite|Gragas');
  add('TOP','AD','FCP','Shen|K\'Sante|Sion');
  add('TOP','AD','RCE','Gnar');
  add('TOP','AP','TMS','Gwen|Mordekaiser');
  add('TOP','AP','ECR','Kennen|Rumble');
  add('TOP','AD','TVM','Fiora|Camille|Jax');
  add('TOP','AD','FVB','Garen|Darius');
  add('TOP','AD','EBC','Renekton|Aatrox');
  add('JUNGLE','AD','FEC','Jarvan IV|Vi|Wukong');
  add('JUNGLE','AP','FECP','Sejuani|Maokai|Amumu|Zac');
  add('JUNGLE','AD','FCD','Poppy|Rammus');
  add('JUNGLE','AP','TSW','Lillia|Brand');
  add('JUNGLE','AP','EMB','Diana|Elise');
  add('JUNGLE','AD','MSB','Viego|Graves|Kha\'Zix|Nocturne');
  add('JUNGLE','AD','TMRS','Kindred|Bel\'Veth');
  add('JUNGLE','AD','EM','Xin Zhao|Lee Sin');
  add('MID','AP','MBC','Ahri|LeBlanc|Sylas');
  add('MID','AP','WCEG','Orianna|Annie');
  add('MID','AP','WOC','Syndra|Hwei|Viktor');
  add('MID','AP','PDC','Lissandra|Galio|Vex|Malzahar');
  add('MID','AP','WCR','Taliyah|Veigar');
  add('MID','AP','BMS','Kassadin|Akali');
  add('MID','AP','WS','Aurelion Sol');
  add('MID','AP','WBG','Twisted Fate');
  add('MID','AD','EMB','Yasuo|Yone|Zed');
  add('ADC','AD','SRT','Jinx|Kog\'Maw|Vayne|Smolder');
  add('ADC','AD','RCO','Ashe|Varus|Jhin');
  add('ADC','AD','RWO','Caitlyn|Miss Fortune|Sivir');
  add('ADC','AD','MDS','Xayah|Zeri|Tristana');
  add('ADC','MIX','MT','Kai\'Sa');
  add('ADC','AD','MOR','Ezreal|Lucian');
  add('ADC','AD','ME','Nilah');
  add('SUPPORT','AP','FECP','Leona|Nautilus|Rell|Alistar');
  add('SUPPORT','AP','FCDP','Braum|Tahm Kench');
  add('SUPPORT','AP','CEDG','Thresh|Rakan|Blitzcrank');
  add('SUPPORT','AP','PDHG','Lulu|Janna|Milio|Soraka');
  add('SUPPORT','AP','PHGO','Nami|Karma');
  add('SUPPORT','AP','OWC','Zyra|Lux');
  add('SUPPORT','AP','PDC','Morgana|Renata Glasc');
  const byKey=new Map();
  for(const p of profiles)byKey.set(norm(p.name),p);
  const roleDefault={
    TOP:['Ornn','Gragas','Gwen','Gnar','Malphite','Camille'],
    JUNGLE:['Vi','Jarvan IV','Sejuani','Poppy','Lillia','Wukong'],
    MID:['Ahri','Orianna','Lissandra','Syndra','Galio','Taliyah'],
    ADC:['Jinx','Ashe','Xayah','Caitlyn','Kai\'Sa','Ezreal'],
    SUPPORT:['Nautilus','Lulu','Janna','Leona','Braum','Rakan'],
  };
  function nameOf(value){
    if(typeof value==='string')return value;
    if(!value||typeof value!=='object')return'';
    return String(value.name||value.championName||value.champion||value.displayName||'');
  }
  function picks(rows,excludeCell){
    return (Array.isArray(rows)?rows:[]).filter(p=>{
      if(!p||!nameOf(p))return false;
      if(excludeCell!=null&&Number(p.cellId)===Number(excludeCell))return false;
      return true;
    }).map(p=>({
      name:nameOf(p),p:byKey.get(norm(nameOf(p)))||null,
      locked:p.lockedIn===true||upper(p.selectionState)==='LOCKED',
      role:role(p.role),
    }));
  }
  function has(p,flag){return Boolean(p&&p.flags.has(flag))}
  function abilityScore(p,allies,enemies,ownRole,knownEnemies,preferred){
    const ap=allies.filter(x=>x.p?.damage==='AP').length;
    const ad=allies.filter(x=>x.p?.damage==='AD').length;
    const alliedFront=allies.filter(x=>has(x.p,'F')).length;
    const alliedCC=allies.filter(x=>has(x.p,'C')).length;
    const enemyFront=enemies.filter(x=>has(x.p,'F')).length;
    const enemyDivers=enemies.filter(x=>has(x.p,'M')||has(x.p,'E')).length;
    const enemyPoke=enemies.filter(x=>has(x.p,'O')||has(x.p,'R')).length;
    const reasons=[],add=(n,why)=>{score+=n;reasons.push({weight:n,reason:why})};
    let score=50;
    if(preferred)add(16,'One of your saved champions');
    if(ad>=2&&p.damage==='AP')add(13,'Adds magic damage to your team');
    if(ap>=2&&p.damage==='AD')add(13,'Adds physical damage to your team');
    if(allies.length>=2&&alliedFront===0&&has(p,'F'))add(15,'Gives your team a frontline');
    if(allies.length>=2&&alliedCC===0&&has(p,'C'))add(9,'Gives your team reliable CC');
    if(allies.length>=2&&allies.some(a=>has(a.p,'E'))&&has(p,'G'))add(7,'Helps your team follow engages');
    if(enemyFront>0&&has(p,'T'))add(Math.min(16,enemyFront*9),'Useful into revealed frontline');
    if(enemyDivers>0&&(has(p,'D')||has(p,'P')))add(Math.min(18,enemyDivers*8),'Protects against revealed dive');
    if(enemyPoke>=2&&has(p,'E'))add(9,'Can start fights against poke');
    if(enemies.filter(x=>x.p?.damage==='AD').length>=2&&has(p,'F'))add(6,'Frontline option into physical damage');
    const opponent=enemies.find(x=>x.role===ownRole&&x.p);
    const special={
      malphite:new Set(['yasuo','yone','tryndamere']),
      lissandra:new Set(['zed','akali','yasuo','yone']),
      poppy:new Set(['lee sin','jarvan iv','vi','camille','rakan']),
      janna:new Set(['leona','rell','nautilus','rakan','alistar']),
      xayah:new Set(['nautilus','leona','rakan','vi','jarvan iv']),
      braum:new Set(['leona','nautilus','rell','rakan']),
    };
    const keys=special[norm(p.name)];
    if(opponent&&keys&&[...keys].some(k=>norm(k)===norm(opponent.name)))add(11,'Tools to answer your revealed lane matchup');
    if(!knownEnemies&&reasons.length===0)reasons.push({weight:0,reason:'Flexible option while enemy picks are hidden'});
    if(reasons.length===0)reasons.push({weight:0,reason:'Role-compatible option for the visible draft'});
    reasons.sort((a,b)=>b.weight-a.weight);
    return{score,reason:reasons.slice(0,2).map(x=>x.reason).join(' · ')};
  }
  function recommend(draft,opts={}){
    if(!draft||typeof draft!=='object')return{role:null,rows:[],enemyKnown:0,allyKnown:0,source:'NONE',message:'Waiting for champion select.'};
    const ownRole=role(opts.role||draft.localRole);
    if(!validRoles.has(ownRole))return{role:null,rows:[],enemyKnown:0,allyKnown:0,source:'NONE',message:'Waiting for your draft role.'};
    const allPicks=picks(draft.allies),enemies=picks(draft.enemies);
    const others=picks(draft.allies,draft.localPlayerCellId>=0?draft.localPlayerCellId:null);
    const known=others.filter(p=>p.locked);
    // LCU reveals an enemy champion only once the opposing pick is available.
    // Its action.completed flag is not reliably supplied for the other team,
    // so count revealed names even when the local normalizer says HOVER.
    const lockedEnemies=enemies;
    const taken=new Set([...others,...lockedEnemies].map(x=>norm(x.name)));
    const banned=new Set([...draft.bans?.allies||[],...draft.bans?.enemies||[]].map(nameOf).map(norm).filter(Boolean));
    const ownLocked=Boolean(draft.localLockedIn);
    const preferred=(Array.isArray(opts.preferred)?opts.preferred:[])
      .map(nameOf).map(name=>byKey.get(norm(name)))
      .filter(p=>p?.role===ownRole);
    const pool=new Set(preferred.map(p=>norm(p.name)));
    const fallback=(roleDefault[ownRole]||[]).map(name=>byKey.get(norm(name))).filter(Boolean);
    const options=[...new Map([...preferred,...fallback].map(p=>[norm(p.name),p])).values()]
      .filter(p=>!taken.has(norm(p.name))&&!banned.has(norm(p.name)));
    const rows=options.map(p=>({name:p.name,role:p.role,fromPool:pool.has(norm(p.name)),
      ...abilityScore(p,known,lockedEnemies,ownRole,lockedEnemies.length,pool.has(norm(p.name)))}))
      // Preserve the curated role shortlist (and the player's own pool order)
      // when draft evidence is tied; alphabetical order is not a ranking.
      .sort((a,b)=>b.score-a.score||options.findIndex(p=>p.name===a.name)-options.findIndex(p=>p.name===b.name)).slice(0,Math.max(1,Math.min(5,Number(opts.limit)||3)));
    // Explicit draft reads tell the player WHY recommendations are changing.
    // These are simple composition observations, never implied probability.
    const allyFront=known.some(x=>has(x.p,'F'));
    const allyAp=known.filter(x=>x.p?.damage==='AP').length;
    const allyAd=known.filter(x=>x.p?.damage==='AD').length;
    const allyCC=known.some(x=>has(x.p,'C'));
    const needs=[];
    if(known.length>=2&&!allyFront)needs.push('FRONTLINE');
    if(known.length>=2&&allyAd>=2&&allyAp===0)needs.push('MAGIC DAMAGE');
    if(known.length>=2&&allyAp>=2&&allyAd===0)needs.push('PHYSICAL DAMAGE');
    if(known.length>=2&&!allyCC)needs.push('RELIABLE CC');
    const seenDive=lockedEnemies.filter(x=>has(x.p,'E')||has(x.p,'M')).length;
    const seenTanks=lockedEnemies.filter(x=>has(x.p,'F')).length;
    const seenPoke=lockedEnemies.filter(x=>has(x.p,'O')).length;
    const threats=[];
    if(seenDive>=1)threats.push('DIVE');
    if(seenTanks>=1)threats.push('FRONTLINE');
    if(seenPoke>=2)threats.push('POKE');
    return{
      role:ownRole,rows,enemyKnown:lockedEnemies.length,allyKnown:known.length,
      needs:needs.slice(0,2),threats:threats.slice(0,2),
      source:pool.size?'PLAYER_POOL':'GENERAL',
      locked:ownLocked,
      message:ownLocked?'Your champion is locked. Recommendations are frozen for this draft.':
        lockedEnemies.length===0?'Early draft: no enemy picks confirmed yet. Suggestions favour your saved pool and team needs.':
        `Based on ${lockedEnemies.length}/5 revealed enemy picks and ${known.length} locked ally picks. Updates as the draft develops.`,
    };
  }
  return Object.freeze({recommend,championProfiles:profiles.map(p=>({name:p.name,role:p.role}))});
});
