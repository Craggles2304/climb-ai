export type TftBoardRole='FRONTLINE'|'CARRY'|'SUPPORT'|'FLEX';
export type TftBoardStar=1|2|3;

export interface TftBoardStats{
  hp?:number;
  armor?:number;
  magicResist?:number;
  attackDamage?:number;
  attackSpeed?:number;
  range?:number;
}

export interface TftBoardUnit{
  id:string;
  championId:string;
  name:string;
  cost:number;
  star:TftBoardStar;
  role:TftBoardRole;
  items:string[];
  traits:string[];
  stats?:TftBoardStats;
  row:number;
  col:number;
}

export interface TftTraitEffect{
  minUnits:number;
  maxUnits?:number;
  style?:number;
}

export interface TftTraitDefinition{
  name:string;
  effects:TftTraitEffect[];
}

export interface TftBoardContext{
  stage:string;
  level:number;
  hp:number;
  gold:number;
  unusedComponents:number;
  completedItemsBench:number;
  augments:string[];
  units:TftBoardUnit[];
  traitDefinitions:TftTraitDefinition[];
}

export interface TftBoardMetric{
  key:'FRONTLINE'|'DAMAGE'|'ITEMS'|'UPGRADES'|'TRAITS'|'POSITIONING';
  label:string;
  score:number;
  evidence:string;
}

export interface TftBoardRead{
  boardStrength:number;
  confidence:number;
  call:'FIELD FULL BOARD'|'ROLL / STABILISE'|'ROLL FOR UPGRADES'|'PUSH LEVEL'|'CLEAN TRAITS / PIVOT'|'REPOSITION'|'HOLD / SCOUT / REASSESS';
  urgency:'LOW'|'MEDIUM'|'HIGH';
  metrics:TftBoardMetric[];
  activeTraits:Array<{name:string;count:number;breakpoint:number;next:number|null}>;
  vulnerabilities:string[];
  reasons:string[];
  nextCheckpoint:string;
}

const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n));
const starBonus=(star:TftBoardStar)=>star===3?42:star===2?18:0;
const stageNumber=(stage:string)=>Number(stage.split('-')[0])||4;

const defensiveWords=['warmog','gargoyle','bramble','dragon\'s claw','sunfire','redemption','steadfast','crownguard','protector','stoneplate','spirit visage','thornmail'];
const offensiveWords=['infinity edge','deathblade','guinsoo','last whisper','jeweled gauntlet','rabadon','archangel','spear of shojin','blue buff','hand of justice','titan','bloodthirster','guardbreaker','nashor','giant slayer'];
const utilityWords=['ionic spark','statikk','morell','red buff','zephyr','shroud','chalice','zeke','locket'];

function itemClass(name:string){
  const n=name.toLowerCase();
  if(defensiveWords.some(x=>n.includes(x)))return'DEFENSE';
  if(offensiveWords.some(x=>n.includes(x)))return'OFFENSE';
  if(utilityWords.some(x=>n.includes(x)))return'UTILITY';
  return'UNKNOWN';
}

function quality(unit:TftBoardUnit){
  return unit.cost*7+starBonus(unit.star)+unit.items.length*5;
}

function durability(unit:TftBoardUnit){
  const s=unit.stats;
  if(!s)return quality(unit);
  const hp=(s.hp||700)/100;
  const res=((s.armor||30)+(s.magicResist||30))/12;
  return quality(unit)+hp+res;
}

function offense(unit:TftBoardUnit){
  const s=unit.stats;
  if(!s)return quality(unit);
  const dps=((s.attackDamage||50)*(s.attackSpeed||0.7))/5;
  const range=(s.range||1)>=3?6:0;
  return quality(unit)+dps+range;
}

function roleItemFit(unit:TftBoardUnit){
  let fit=0,known=0;
  for(const item of unit.items){
    const kind=itemClass(item);
    if(kind==='UNKNOWN')continue;
    known++;
    if(unit.role==='FRONTLINE'&&kind==='DEFENSE')fit++;
    else if(unit.role==='CARRY'&&kind==='OFFENSE')fit++;
    else if(unit.role==='SUPPORT'&&kind==='UTILITY')fit++;
    else if(unit.role==='FLEX')fit+=0.7;
    else if(kind==='UTILITY')fit+=0.5;
  }
  return{fit,known};
}

function traitRead(ctx:TftBoardContext){
  const counts=new Map<string,number>();
  ctx.units.forEach(u=>u.traits.forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
  const definitions=new Map(ctx.traitDefinitions.map(t=>[t.name,t]));
  const rows:Array<{name:string;count:number;breakpoint:number;next:number|null}>=[];
  let activeCoverage=0;
  const activeNames=new Set<string>();
  let orphans=0;

  for(const [name,count] of counts){
    const def=definitions.get(name);
    const thresholds=(def?.effects||[]).map(e=>e.minUnits).filter(Boolean).sort((a,b)=>a-b);
    let breakpoint=0;
    if(thresholds.length){
      breakpoint=thresholds.filter(x=>x<=count).pop()||0;
    }else if(count>=2)breakpoint=2;
    const next=thresholds.find(x=>x>count)??null;
    if(breakpoint){activeNames.add(name);rows.push({name,count,breakpoint,next});}
    else orphans++;
  }
  ctx.units.forEach(u=>{if(u.traits.some(t=>activeNames.has(t)))activeCoverage++});
  const coverage=ctx.units.length?activeCoverage/ctx.units.length:0;
  const score=ctx.units.length?Math.round(clamp(28+coverage*46+Math.min(18,rows.length*5)-Math.min(18,orphans*2.5))):0;
  return{score,rows:rows.sort((a,b)=>b.count-a.count),orphans,coverage};
}

export function analyseTftBoard(ctx:TftBoardContext):TftBoardRead{
  const units=ctx.units.slice(0,ctx.level);
  const stage=stageNumber(ctx.stage);
  const front=units.filter(u=>u.role==='FRONTLINE'||u.role==='FLEX');
  const carries=units.filter(u=>u.role==='CARRY'||u.role==='FLEX');
  const supports=units.filter(u=>u.role==='SUPPORT');
  const oneStars=units.filter(u=>u.star===1);
  const threeStars=units.filter(u=>u.star===3);
  const totalItems=units.reduce((n,u)=>n+u.items.length,0);

  const frontPower=front.reduce((n,u)=>n+durability(u),0);
  const frontCoverage=Math.min(1,front.length/Math.max(2,Math.ceil(ctx.level*0.35)));
  const frontline=Math.round(clamp((frontPower/Math.max(1,front.length))*0.62+frontCoverage*34-(front.length===0?45:0)));

  const carryPower=carries.reduce((n,u)=>n+offense(u),0);
  const carryItems=carries.reduce((n,u)=>n+u.items.length,0);
  const damage=Math.round(clamp((carryPower/Math.max(1,carries.length))*0.63+Math.min(28,carryItems*5)-(carries.length===0?42:0)));

  let knownFit=0,fit=0;
  units.forEach(u=>{const x=roleItemFit(u);knownFit+=x.known;fit+=x.fit});
  const fitRate=knownFit?fit/knownFit:0.6;
  const benchPenalty=ctx.unusedComponents*3.5+ctx.completedItemsBench*11;
  const items=Math.round(clamp(34+Math.min(34,totalItems*4.2)+fitRate*20-benchPenalty));

  const early=Math.max(0,4-stage);
  const oneStarPenalty=oneStars.reduce((n,u)=>n+(u.cost>=4?6:11),0)*Math.max(.45,1-early*.2);
  const upgrades=Math.round(clamp(88-oneStarPenalty+threeStars.length*8-(units.length<ctx.level?(ctx.level-units.length)*14:0)));

  const traits=traitRead({...ctx,units});

  let positionPenalty=0;
  for(const u of units){
    if(u.role==='FRONTLINE'&&u.row>=2)positionPenalty+=13;
    if(u.role==='CARRY'&&u.row<=1)positionPenalty+=16;
    if(u.role==='SUPPORT'&&u.row===0)positionPenalty+=7;
  }
  const frontRows=units.filter(u=>u.row<=1).length;
  if(frontRows===0&&units.length>=4)positionPenalty+=20;
  if(frontRows===1&&units.length>=6)positionPenalty+=8;
  const carryBack=units.filter(u=>u.role==='CARRY'&&u.row>=2).length;
  const positioning=Math.round(clamp(86-positionPenalty+Math.min(8,carryBack*3)));

  const metrics:TftBoardMetric[]=[
    {key:'FRONTLINE',label:'Frontline',score:frontline,evidence:front.length?`${front.length} frontline/flex unit${front.length===1?'':'s'} · ${front.reduce((n,u)=>n+u.items.length,0)} item${front.reduce((n,u)=>n+u.items.length,0)===1?'':'s'}`:'No unit is marked as frontline.'},
    {key:'DAMAGE',label:'Damage',score:damage,evidence:carries.length?`${carries.length} carry/flex unit${carries.length===1?'':'s'} · ${carryItems} carry item${carryItems===1?'':'s'}`:'No primary damage unit is marked.'},
    {key:'ITEMS',label:'Item efficiency',score:items,evidence:`${totalItems} equipped · ${ctx.unusedComponents} component${ctx.unusedComponents===1?'':'s'} held · ${ctx.completedItemsBench} completed item${ctx.completedItemsBench===1?'':'s'} benched`},
    {key:'UPGRADES',label:'Upgrade density',score:upgrades,evidence:`${oneStars.length} one-star · ${units.filter(u=>u.star===2).length} two-star · ${threeStars.length} three-star`},
    {key:'TRAITS',label:'Trait efficiency',score:traits.score,evidence:`${traits.rows.length} active breakpoint${traits.rows.length===1?'':'s'} · ${traits.orphans} inactive/orphan trait${traits.orphans===1?'':'s'}`},
    {key:'POSITIONING',label:'Positioning structure',score:positioning,evidence:`${frontRows} unit${frontRows===1?'':'s'} in front two rows · ${carryBack} carry${carryBack===1?'':'s'} protected in back two rows`},
  ];

  const weighted=frontline*.20+damage*.20+items*.15+upgrades*.15+traits.score*.15+positioning*.15;
  const boardStrength=Math.round(clamp(weighted-(units.length<ctx.level?(ctx.level-units.length)*5:0)));

  const vulnerabilities:string[]=[];
  if(frontline<58)vulnerabilities.push('Frontline is the first structural leak; the board may lose time before damage can convert.');
  if(damage<58)vulnerabilities.push('Damage concentration is low; identify one real carry and give it a complete item package.');
  if(items<58)vulnerabilities.push('Too much usable power is sitting off-board or items are poorly matched to unit roles.');
  if(upgrades<58)vulnerabilities.push(`${oneStars.length} one-star unit${oneStars.length===1?' remains':'s remain'} for this stage/level context.`);
  if(traits.score<55)vulnerabilities.push('Trait structure is inefficient; too many trait slots are not reaching a meaningful breakpoint.');
  if(positioning<58)vulnerabilities.push('Role-to-row structure is exposing carries or leaving frontline too deep.');
  if(!vulnerabilities.length)vulnerabilities.push('No major structural leak is obvious from the entered board. The next edge is likely matchup-specific scouting or cap quality.');

  let call:TftBoardRead['call']='HOLD / SCOUT / REASSESS';
  let urgency:TftBoardRead['urgency']='LOW';
  const reasons:string[]=[];
  if(units.length<ctx.level){
    call='FIELD FULL BOARD';urgency='HIGH';reasons.push(`You are level ${ctx.level} but only ${units.length} board slot${units.length===1?' is':'s are'} filled.`);reasons.push('An empty field slot is immediate lost combat power before any roll/level optimisation.');
  }else if(positioning<50){
    call='REPOSITION';urgency=ctx.hp<=45?'HIGH':'MEDIUM';reasons.push('The current row structure conflicts with the roles you assigned.');reasons.push('Repositioning costs no gold, so fix free board-strength errors before spending economy.');
  }else if(boardStrength<56&&ctx.hp<=55&&ctx.gold>=20){
    call='ROLL / STABILISE';urgency=ctx.hp<=35?'HIGH':'MEDIUM';reasons.push(`Board Strength is ${boardStrength}/100 while HP is ${ctx.hp}.`);reasons.push(`${ctx.gold}g gives enough resource to search for immediate upgrades before more HP is traded away.`);
  }else if(upgrades<55&&ctx.gold>=20){
    call='ROLL FOR UPGRADES';urgency=ctx.hp<=50?'HIGH':'MEDIUM';reasons.push(`${oneStars.length} one-star units are suppressing upgrade density.`);reasons.push('The entered board has more immediate value in upgrades than in adding another low-impact slot.');
  }else if(traits.score<45&&traits.orphans>=3){
    call='CLEAN TRAITS / PIVOT';urgency='MEDIUM';reasons.push(`${traits.orphans} trait entries are not reaching an active breakpoint.`);reasons.push('Board slots are being spent without enough trait conversion; clean the line before investing deeper.');
  }else if(boardStrength>=72&&ctx.gold>=40&&ctx.level<9&&ctx.hp>=50){
    call='PUSH LEVEL';urgency='LOW';reasons.push(`Board Strength is already ${boardStrength}/100 with ${ctx.hp} HP.`);reasons.push(`${ctx.gold}g allows you to turn stability into a higher cap instead of over-rolling an already functional board.`);
  }else{
    reasons.push(`The board reads ${boardStrength}/100 without a forced emergency spend from the entered state.`);reasons.push('Scout the strongest likely opponent and preserve options until the next clear breakpoint or danger threshold.');
  }

  const traitDataUnits=units.filter(u=>u.traits.length).length;
  const statUnits=units.filter(u=>u.stats&&Object.keys(u.stats).length).length;
  const roleUnits=units.filter(u=>u.role).length;
  const confidence=units.length?Math.round(clamp(38+(traitDataUnits/units.length)*18+(statUnits/units.length)*14+(roleUnits/units.length)*10+Math.min(10,totalItems*1.5),0,92)):0;

  const lowest=[...metrics].sort((a,b)=>a.score-b.score)[0];
  const nextCheckpoint=lowest?`Before spending gold, ask whether the next action raises ${lowest.label.toLowerCase()} enough to change the board's weakest axis.`:'Add units to generate a board read.';

  return{boardStrength,confidence,call,urgency,metrics,activeTraits:traits.rows,vulnerabilities:vulnerabilities.slice(0,4),reasons,nextCheckpoint};
}
