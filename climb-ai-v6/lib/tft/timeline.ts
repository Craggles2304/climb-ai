export type TftTelemetryPoint={
  at:string; round:string; gold?:number; level?:number; xp?:number; hp?:number; placement?:number;
  shopRefreshes?:number; purchases?:number; boardPower?:number; boardUnits?:number;
  benchUnits?:number; heldComponents?:number; completedItems?:number;
};
export type TftTimeline={version:1; matchId:string; source:'local-player'; points:TftTelemetryPoint[]};
export type TftFinding={key:string; title:string; status:'OBSERVED'|'NOT OBSERVED'; evidence:string; principle:string};

const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
const round=(value:unknown)=>typeof value==='string'&&/^\d+-\d+$/.test(value)?value:'';
export function parseTftTimeline(input:unknown):TftTimeline{
  if(!input||typeof input!=='object')throw new Error('Timeline must be a JSON object.');
  const raw=input as Record<string,unknown>;
  if(raw.version!==1||raw.source!=='local-player'||typeof raw.matchId!=='string'||!raw.matchId.trim()||!Array.isArray(raw.points))throw new Error('Expected version 1 local-player timeline with a matchId and points.');
  if(raw.points.length>1000)throw new Error('Timeline is too large.');
  const points=raw.points.map((point,index)=>{
    if(!point||typeof point!=='object')throw new Error(`Point ${index+1} is invalid.`);
    const p=point as Record<string,unknown>;
    if(typeof p.at!=='string'||!Number.isFinite(Date.parse(p.at))||!round(p.round))throw new Error(`Point ${index+1} needs a timestamp and stage-round.`);
    return{at:p.at,round:round(p.round),gold:number(p.gold),level:number(p.level),xp:number(p.xp),hp:number(p.hp),placement:number(p.placement),shopRefreshes:number(p.shopRefreshes),purchases:number(p.purchases),boardPower:number(p.boardPower),boardUnits:number(p.boardUnits),benchUnits:number(p.benchUnits),heldComponents:number(p.heldComponents),completedItems:number(p.completedItems)};
  }).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  return{version:1,source:'local-player',matchId:raw.matchId.trim(),points};
}

export function analyzeTftTimeline(timeline:TftTimeline):TftFinding[]{
  const p=timeline.points;
  const finding=(key:string,title:string,evidence:string|undefined,principle:string):TftFinding=>({key,title,status:evidence?'OBSERVED':'NOT OBSERVED',evidence:evidence||'NOT OBSERVED — the recorded fields do not prove this pattern.',principle});
  const late=p.find((x,i)=>i>0&&x.hp!==undefined&&x.hp<=45&&x.gold!==undefined&&x.gold>=45&&p[i-1].hp!==undefined&&p[i-1].hp!>x.hp&&p.slice(i+1,i+4).some(y=>y.hp!==undefined&&y.hp<=25&&y.shopRefreshes!==undefined&&y.shopRefreshes>0));
  const over=p.find(x=>x.shopRefreshes!==undefined&&x.shopRefreshes>=8&&x.gold!==undefined&&x.gold<10&&x.hp!==undefined&&x.hp>55);
  const nativeRoll=p.find(x=>x.shopRefreshes!==undefined&&x.shopRefreshes>=6&&x.gold!==undefined&&x.gold<=15);
  const nativeBuy=p.find(x=>x.purchases!==undefined&&x.purchases>=3&&x.gold!==undefined);
  const levelSpend=p.find((x,i)=>i>0&&x.level!==undefined&&p[i-1].level!==undefined&&x.level>p[i-1].level!&&x.gold!==undefined&&p[i-1].gold!==undefined&&p[i-1].gold!>x.gold);
  const econHold=p.find((x,i)=>i>0&&x.gold!==undefined&&x.gold>=50&&p[i-1].gold!==undefined&&p[i-1].gold!>=50&&x.round!==p[i-1].round);
  const weak=p.find((x,i)=>i>0&&x.boardPower!==undefined&&p[i-1].boardPower!==undefined&&x.boardPower<=p[i-1].boardPower!&&x.hp!==undefined&&p[i-1].hp!==undefined&&x.hp<p[i-1].hp!);
  const items=p.find((x,i)=>i>1&&x.heldComponents!==undefined&&x.heldComponents>=4&&p[i-1].heldComponents!==undefined&&p[i-1].heldComponents!>=4&&p[i-2].heldComponents!==undefined&&p[i-2].heldComponents!>=4);
  const level=p.find((x,i)=>i>0&&x.level!==undefined&&p[i-1].level!==undefined&&x.level===p[i-1].level&&x.gold!==undefined&&x.gold>=50&&x.hp!==undefined&&x.hp<40);
  return[
    finding('roll-down','Recorded roll-down',nativeRoll?`${nativeRoll.round}: ${nativeRoll.shopRefreshes} shop refreshes were recorded with ${nativeRoll.gold} gold remaining.`:undefined,'Review what changed after the roll-down: did the spend create enough playable strength for the stage?'),
    finding('shop-commitment','Shop commitment burst',nativeBuy?`${nativeBuy.round}: ${nativeBuy.purchases} purchases were recorded in the round with ${nativeBuy.gold} gold visible.`:undefined,'Check whether the units bought supported one coherent board direction rather than consuming economy without a plan.'),
    finding('level-spend','Level-up spend recorded',levelSpend?`${levelSpend.round}: level increased from ${p[p.indexOf(levelSpend)-1]?.level} to ${levelSpend.level} while visible gold fell from ${p[p.indexOf(levelSpend)-1]?.gold} to ${levelSpend.gold}.`:undefined,'Review whether the level-up created an immediate board or slot advantage at the right stage.'),
    finding('economy-hold','Economy held across stages',econHold?`${econHold.round}: visible gold stayed at 50+ across consecutive recorded rounds.`:undefined,'Preserving economy is useful only when the board can afford it; compare this hold with your final placement and later spend window.'),
    finding('late-roll','Possible late stabilisation',late?`${late.round}: ${late.hp} HP, ${late.gold} gold; later HP fell below 25 before recorded refreshes.`:undefined,'Review whether an earlier stabilisation window was available.'),
    finding('over-roll','Heavy rolling while healthy',over?`${over.round}: ${over.shopRefreshes} recorded refreshes, ${over.gold} gold remaining, ${over.hp} HP.`:undefined,'Check whether the extra rolls changed your board enough to justify the spend.'),
    finding('weak-board','Board did not strengthen',weak?`${weak.round}: board power ${weak.boardPower} while HP fell to ${weak.hp}.`:undefined,'Look for a stronger playable board before committing to a final comp.'),
    finding('held-items','Components held across rounds',items?`${items.round}: ${items.heldComponents} components remained uncombined for three recorded points.`:undefined,'Review the item tempo tradeoff after the match.'),
    finding('level-timing','Level held under pressure',level?`${level.round}: level ${level.level}, ${level.gold} gold, ${level.hp} HP.`:undefined,'Compare levelling with immediate board upgrades.'),
  ];
}
