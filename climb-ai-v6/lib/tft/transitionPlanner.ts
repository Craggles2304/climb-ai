import {analyseTftBoard,type TftBoardContext,type TftBoardRead,type TftBoardRole,type TftBoardStar,type TftBoardUnit} from './boardLab';
import {buildCarryShell,type TftCarryItemBuild,type TftCarryProfile,type TftStaticChampion} from './carryBuilder';

export type TftTransitionCall='HOLD CURRENT CORE'|'LIGHT PIVOT'|'TRANSITION IN STAGES'|'STABILISE FIRST'|'LEVEL THEN TRANSITION';
export type TftTransitionRisk='LOW'|'MEDIUM'|'HIGH';

export interface TftTransitionUnitChange{
  name:string;
  cost:number;
  role:string;
  reason:string;
}

export interface TftTransitionTraitChange{
  name:string;
  currentCount:number;
  targetCount:number;
  currentBreakpoint:number;
  targetBreakpoint:number;
  delta:number;
  direction:'GAIN'|'LOSS'|'UPGRADE'|'DOWNGRADE';
}

export interface TftTransitionItemHolder{
  holder:string|null;
  targetCarry:string;
  targetItems:string[];
  matchingItems:string[];
  note:string;
}

export interface TftTransitionRead{
  call:TftTransitionCall;
  risk:TftTransitionRisk;
  confidence:number;
  currentRead:TftBoardRead;
  targetRead:TftBoardRead;
  strengthDelta:number;
  purchaseFloor:number;
  targetSize:number;
  keep:TftTransitionUnitChange[];
  enter:TftTransitionUnitChange[];
  exit:TftTransitionUnitChange[];
  traitChanges:TftTransitionTraitChange[];
  itemHolder:TftTransitionItemHolder;
  targetContext:TftBoardContext;
  sequence:string[];
  reasons:string[];
  assumptions:string[];
}

const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n));

function roleFromShell(role:string,isCarry:boolean):TftBoardRole{
  if(isCarry)return'CARRY';
  if(role==='FRONTLINE')return'FRONTLINE';
  if(role==='UTILITY')return'SUPPORT';
  return'FLEX';
}

function targetPosition(role:TftBoardRole,index:number){
  const col=index%7;
  if(role==='FRONTLINE')return{row:0,col};
  if(role==='CARRY')return{row:3,col};
  if(role==='SUPPORT')return{row:2,col};
  return{row:index%2?1:2,col};
}

function preserveStar(current:TftBoardUnit|undefined,cost:number):TftBoardStar{
  if(current)return current.star;
  // The target read models an attainable transition state, not a fantasy fully-upgraded cap board.
  // Missing units therefore enter as one-star regardless of cost.
  void cost;
  return 1;
}

function buildTargetContext(current:TftBoardContext,profile:TftCarryProfile,build:TftCarryItemBuild,champions:TftStaticChampion[],targetSize:number){
  const shell=buildCarryShell(profile,champions,targetSize);
  const currentByName=new Map(current.units.map(u=>[norm(u.name),u]));
  const units:TftBoardUnit[]=shell.units.map((entry,index)=>{
    const champ=entry.champion;
    const existing=currentByName.get(norm(champ.name));
    const isCarry=norm(champ.name)===norm(profile.champion);
    const role=roleFromShell(entry.role,isCarry);
    const pos=existing?{row:existing.row,col:existing.col}:targetPosition(role,index);
    return{
      id:existing?.id||`transition-${champ.id}-${index}`,
      championId:champ.id,
      name:champ.name,
      cost:Number(champ.tier)||1,
      star:preserveStar(existing,Number(champ.tier)||1),
      role,
      items:isCarry?[...build.items]:(existing?.items||[]),
      traits:champ.traits||[],
      stats:champ.stats||undefined,
      row:pos.row,
      col:pos.col,
    };
  });
  return{shell,context:{...current,level:targetSize,units} satisfies TftBoardContext};
}

function changes(current:TftBoardContext,target:TftBoardContext,profile:TftCarryProfile){
  const currentMap=new Map(current.units.map(u=>[norm(u.name),u]));
  const targetMap=new Map(target.units.map(u=>[norm(u.name),u]));
  const keep:TftTransitionUnitChange[]=[];
  const enter:TftTransitionUnitChange[]=[];
  const exit:TftTransitionUnitChange[]=[];

  for(const unit of target.units){
    const old=currentMap.get(norm(unit.name));
    const row={name:unit.name,cost:unit.cost,role:unit.role,reason:norm(unit.name)===norm(profile.champion)?'Target carry / anchor.':'Retained because it fits the generated target shell.'};
    if(old)keep.push(row);
    else enter.push({...row,reason:norm(unit.name)===norm(profile.champion)?'Missing target carry / anchor.':'Missing structural unit for the target shell.'});
  }
  for(const unit of current.units){
    if(!targetMap.has(norm(unit.name)))exit.push({name:unit.name,cost:unit.cost,role:unit.role,reason:'Current slot does not appear in the generated target shell.'});
  }
  return{keep,enter,exit};
}

function traitMap(read:TftBoardRead){
  return new Map(read.activeTraits.map(t=>[t.name,{count:t.count,breakpoint:t.breakpoint}]));
}

function compareTraits(current:TftBoardRead,target:TftBoardRead):TftTransitionTraitChange[]{
  const a=traitMap(current),b=traitMap(target);
  const names=new Set([...a.keys(),...b.keys()]);
  const rows:TftTransitionTraitChange[]=[];
  for(const name of names){
    const currentRow=a.get(name)||{count:0,breakpoint:0};
    const targetRow=b.get(name)||{count:0,breakpoint:0};
    if(currentRow.count===targetRow.count&&currentRow.breakpoint===targetRow.breakpoint)continue;
    let direction:TftTransitionTraitChange['direction'];
    if(currentRow.breakpoint===0&&targetRow.breakpoint>0)direction='GAIN';
    else if(currentRow.breakpoint>0&&targetRow.breakpoint===0)direction='LOSS';
    else if(targetRow.breakpoint>currentRow.breakpoint||targetRow.count>currentRow.count)direction='UPGRADE';
    else direction='DOWNGRADE';
    rows.push({name,currentCount:currentRow.count,targetCount:targetRow.count,currentBreakpoint:currentRow.breakpoint,targetBreakpoint:targetRow.breakpoint,delta:targetRow.count-currentRow.count,direction});
  }
  const weight=(x:TftTransitionTraitChange)=>x.direction==='GAIN'?4:x.direction==='UPGRADE'?3:x.direction==='LOSS'?2:1;
  return rows.sort((x,y)=>weight(y)-weight(x)||Math.abs(y.delta)-Math.abs(x.delta)||x.name.localeCompare(y.name));
}

function findItemHolder(current:TftBoardContext,profile:TftCarryProfile,build:TftCarryItemBuild):TftTransitionItemHolder{
  const wanted=new Set(build.items.map(norm));
  const target=current.units.find(u=>norm(u.name)===norm(profile.champion));
  if(target){
    const matching=target.items.filter(i=>wanted.has(norm(i)));
    return{holder:target.name,targetCarry:profile.champion,targetItems:build.items,matchingItems:matching,note:`${profile.champion} is already fielded. Keep compatible items there and only rebuild slots that conflict with the selected package.`};
  }
  const ranked=current.units.map(unit=>({unit,matching:unit.items.filter(i=>wanted.has(norm(i)))})).sort((a,b)=>b.matching.length-a.matching.length||b.unit.items.length-a.unit.items.length||b.unit.cost-a.unit.cost);
  const best=ranked[0];
  if(!best||best.unit.items.length===0)return{holder:null,targetCarry:profile.champion,targetItems:build.items,matchingItems:[],note:`No equipped item holder is recorded. Treat ${build.items.join(' + ')} as the target package rather than assuming the components exist.`};
  return{holder:best.unit.name,targetCarry:profile.champion,targetItems:build.items,matchingItems:best.matching,note:best.matching.length?`${best.unit.name} already holds ${best.matching.length} matching target item${best.matching.length===1?'':'s'}. Keep it until ${profile.champion} is ready to receive the package.`:`${best.unit.name} is the most item-loaded current unit, but none of its items exactly match the selected ${profile.champion} package. Do not assume a clean transfer.`};
}

function decideCall(current:TftBoardContext,currentRead:TftBoardRead,targetRead:TftBoardRead,enter:TftTransitionUnitChange[],purchaseFloor:number,targetSize:number):{call:TftTransitionCall;risk:TftTransitionRisk;reasons:string[]}{
  const reasons:string[]=[];
  const carryMissing=enter.some(u=>u.role==='CARRY');
  const expensiveMissing=enter.filter(u=>u.cost>=4).length;
  const delta=targetRead.boardStrength-currentRead.boardStrength;
  const swapLoad=enter.length;
  const lowHp=current.hp<=40;
  const canCoverFloor=current.gold>=purchaseFloor;
  let call:TftTransitionCall='TRANSITION IN STAGES';
  let risk:TftTransitionRisk='MEDIUM';

  if(swapLoad===0){call='HOLD CURRENT CORE';risk='LOW';reasons.push('The current board already contains every unit in the generated target shell.');reasons.push('Improve stars, positioning or item completion before changing the core.');}
  else if(lowHp&&currentRead.boardStrength<58&&(swapLoad>=3||!canCoverFloor)){
    call='STABILISE FIRST';risk='HIGH';reasons.push(`${current.hp} HP and a ${currentRead.boardStrength}/100 current board leave little room for a multi-unit bench transition.`);reasons.push(`${swapLoad} target units are missing${canCoverFloor?' even before shop-search variance is considered':` and the ${purchaseFloor}g minimum purchase floor exceeds the ${current.gold}g entered state`}.`);
  }else if(targetSize>current.level&&currentRead.boardStrength>=68&&current.gold>=35){
    call='LEVEL THEN TRANSITION';risk=expensiveMissing>=2?'MEDIUM':'LOW';reasons.push(`The current board is already ${currentRead.boardStrength}/100 and the target uses ${targetSize} slots versus level ${current.level}.`);reasons.push('Preserve the stable board while opening the extra slot instead of selling functional units too early.');
  }else if(swapLoad<=2&&purchaseFloor<=Math.max(8,current.gold*.35)){
    call='LIGHT PIVOT';risk=lowHp?'MEDIUM':'LOW';reasons.push(`Only ${swapLoad} unit${swapLoad===1?' is':'s are'} missing from the target shell.`);reasons.push(`${purchaseFloor}g is the minimum direct purchase cost before reroll/search costs, so the structural change is comparatively light.`);
  }else{
    call='TRANSITION IN STAGES';risk=(swapLoad>=4||expensiveMissing>=2||carryMissing&&current.gold<30)?'HIGH':'MEDIUM';reasons.push(`${swapLoad} units need replacing, including ${expensiveMissing} missing 4/5-cost unit${expensiveMissing===1?'':'s'}.`);reasons.push('Build the target in layers; selling the whole current board first creates unnecessary transition risk.');
  }
  if(delta>=8)reasons.push(`The attainable target-state proxy improves Board Strength by ${delta} points if the listed units can actually be found.`);
  else if(delta<=-4)reasons.push(`The immediate one-star target proxy is ${Math.abs(delta)} points weaker than the current board, so the target needs upgrades before it deserves a full swap.`);
  return{call,risk,reasons};
}

export function analyseTftTransition(args:{current:TftBoardContext;profile:TftCarryProfile;build:TftCarryItemBuild;champions:TftStaticChampion[];targetSize:number}):TftTransitionRead{
  const targetSize=Math.max(3,Math.min(10,args.targetSize));
  const {shell,context:targetContext}=buildTargetContext(args.current,args.profile,args.build,args.champions,targetSize);
  const currentRead=analyseTftBoard(args.current);
  const targetRead=analyseTftBoard(targetContext);
  const {keep,enter,exit}=changes(args.current,targetContext,args.profile);
  const purchaseFloor=enter.reduce((sum,u)=>sum+Math.max(1,u.cost),0);
  const strengthDelta=targetRead.boardStrength-currentRead.boardStrength;
  const traitChanges=compareTraits(currentRead,targetRead);
  const itemHolder=findItemHolder(args.current,args.profile,args.build);
  const decision=decideCall(args.current,currentRead,targetRead,enter,purchaseFloor,targetSize);

  const frontlineFirst=enter.filter(u=>u.role==='FRONTLINE').map(u=>u.name);
  const carryEntry=enter.find(u=>u.role==='CARRY');
  const otherEntries=enter.filter(u=>u.role!=='FRONTLINE'&&u.role!=='CARRY').map(u=>u.name);
  const sequence:string[]=[];
  if(itemHolder.holder&&itemHolder.holder!==args.profile.champion)sequence.push(`Keep ${itemHolder.holder} as the temporary item holder until ${args.profile.champion} is actually purchasable and fieldable.`);
  if(frontlineFirst.length)sequence.push(`Add/upgrade frontline bridge first: ${frontlineFirst.slice(0,3).join(', ')}. Do not strip protection from the current carry before the replacement frontline exists.`);
  if(otherEntries.length)sequence.push(`Add trait/utility bridge next: ${otherEntries.slice(0,4).join(', ')}. Remove matching exit units one-for-one rather than clearing the board at once.`);
  if(carryEntry)sequence.push(`Field ${carryEntry.name} only when the board can support it, then move compatible carry items across and complete ${args.build.label}.`);
  if(exit.length)sequence.push(`Final clean-up: remove ${exit.slice(0,5).map(u=>u.name).join(', ')} only after their replacement slots are secured.`);
  if(!sequence.length)sequence.push('The target shell is already present. Spend the next resources on upgrades, item completion and positioning rather than changing the core.');

  const traitCoverage=shell.units.length?targetContext.units.filter(u=>u.traits.length>0).length/shell.units.length:0;
  const statCoverage=shell.units.length?targetContext.units.filter(u=>u.stats&&Object.keys(u.stats).length>0).length/shell.units.length:0;
  const currentEvidence=args.current.units.length?Math.min(1,args.current.units.length/Math.max(1,args.current.level)):0;
  const confidence=Math.round(clamp(28+currentRead.confidence*.28+traitCoverage*16+statCoverage*12+currentEvidence*12+(shell.carry?7:0),0,92));

  return{
    call:decision.call,risk:decision.risk,confidence,currentRead,targetRead,strengthDelta,purchaseFloor,targetSize,
    keep,enter,exit,traitChanges,itemHolder,targetContext,sequence,reasons:decision.reasons,
    assumptions:[
      'The target shell is generated from current Riot static traits/stats plus the selected OP CLIMB carry profile; it is a structural target, not a claim that one exact comp is universally optimal.',
      'Missing target units enter the comparison at one star. Existing units keep their recorded star level, so the target read is an attainable transition proxy rather than a fully-upgraded fantasy board.',
      'Purchase floor is only the face-value cost of missing units. It excludes reroll/search gold, shop odds, sell value, duplicators, special set mechanics and contested copies.',
      'This planner is for static preparation and post-game reconstruction. It is not adaptive live-game shotcalling.'
    ]
  };
}
