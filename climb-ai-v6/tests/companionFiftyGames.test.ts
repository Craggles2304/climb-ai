import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
// @ts-expect-error The packaged Companion runtime is plain JavaScript.
import {normalizePregame} from '../companion/src/pregame-normalizer.mjs';
// @ts-expect-error The packaged Companion runtime is plain JavaScript.
import {recoveryPregameContext} from '../companion/src/in-game-recovery.mjs';
import {buildPregameTeamPlan} from '../lib/champions/teamCompPlan';
import {buildCompositionStrategy} from '../lib/champions/compositionIntelligence';
import {buildAdaptiveItemPlan} from '../lib/adaptiveBuildPlanner';
import type {ChampionDetail} from '../lib/champions/ddragon';
import type {DataDragonItemFull} from '../lib/champions/source';

const require=createRequire(import.meta.url);
const {draftFromLocalContext}=require('../companion/electron/live-draft.cjs');
const roles=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const positions=['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
const profiles=['TANK','DIVE','HEAL','POKE','PHYSICAL','MAGIC','PICK','BALANCED','FRONTLINE','SKIRMISH'];
const allyNames=['Garen','Vi','Ahri','Jinx','Lulu'];
const enemyNames=Array.from({length:10},(_,profile)=>Array.from({length:5},(_,slot)=>`Enemy${profile}_${slot}`));

function champion(name:string,profile:string,slot:number):ChampionDetail{
  const tank=profile==='TANK'||profile==='FRONTLINE';
  const healer=profile==='HEAL'&&slot>=3;
  const mage=profile==='MAGIC'||profile==='POKE'||healer||slot===2;
  const marksman=slot===3&&!tank&&!healer;
  const tags=tank?['Tank']:healer?['Support','Mage']:marksman?['Marksman']:mage?['Mage']:['Fighter'];
  const spell=profile==='DIVE'||profile==='PICK'?'Dashes and stuns the target.':healer?'Heals and restores health.':tank?'Knocks up enemies.':'';
  return{
    id:name,key:String(slot+1),name,title:'fixture',tags,partype:'Mana',
    info:{attack:mage?2:8,defense:tank?9:4,magic:mage?9:2,difficulty:5},
    stats:{hp:tank?850:600,hpperlevel:100,armor:tank?50:30,armorperlevel:4,spellblock:30,spellblockperlevel:1.3,
      attackdamage:60,attackdamageperlevel:3,attackspeed:.65,attackspeedperlevel:3,movespeed:330,
      attackrange:mage||marksman?550:175,mp:300,mpperlevel:40},
    spells:[{id:'q',name:'Q',maxrank:5,description:spell} as any,{id:'w',name:'W',maxrank:5,description:spell} as any],
    passive:{name:'Passive',description:''},allytips:[],enemytips:[],
  };
}

function item(name:string,stats:Record<string,number>,description:string,tags:string[]):DataDragonItemFull{
  return{name,gold:{total:3000},stats,description,plaintext:description,from:['1000'],maps:{'11':true},tags} as DataDragonItemFull;
}
const items:Record<string,DataDragonItemFull>={
  '10001':item('Physical Core',{FlatPhysicalDamageMod:70,FlatCritChanceMod:.25},'Critical damage.',['Damage','CriticalStrike']),
  '10002':item('Attack Speed Core',{FlatPhysicalDamageMod:35,PercentAttackSpeedMod:.45,FlatCritChanceMod:.25},'Attack speed.',['AttackSpeed','Damage']),
  '10003':item('Tank Piercer',{FlatPhysicalDamageMod:45,FlatCritChanceMod:.25},'Armor penetration against high health.',['ArmorPenetration','Damage']),
  '10004':item('Cleanse Blade',{FlatPhysicalDamageMod:45,FlatCritChanceMod:.25},'Remove crowd control.',['Damage']),
  '10005':item('Anti Heal',{FlatPhysicalDamageMod:40,FlatCritChanceMod:.25},'Applies Grievous Wounds.',['Damage']),
  '10006':item('Magic Guard',{FlatPhysicalDamageMod:45,FlatSpellBlockMod:40},'Spell shield against magic damage.',['Damage','SpellBlock']),
  '10007':item('Armor Guard',{FlatPhysicalDamageMod:40,FlatArmorMod:45},'Survive physical damage.',['Damage','Armor']),
  '10008':item('AP Core',{FlatMagicDamageMod:120},'High ability power.',['SpellDamage']),
  '10009':item('AP Armor',{FlatMagicDamageMod:90,FlatArmorMod:40},'Stasis against dive.',['SpellDamage','Armor']),
  '10010':item('AP Penetration',{FlatMagicDamageMod:85},'Magic penetration against resistance.',['SpellDamage']),
  '20001':item('Steel Boots',{FlatArmorMod:25},'Reduces basic attack damage.',['Boots','Armor']),
  '20002':item('Mercury Boots',{FlatSpellBlockMod:25},'Magic resistance and tenacity.',['Boots','SpellBlock']),
  '20003':item('Attack Speed Boots',{PercentAttackSpeedMod:.30},'Attack speed.',['Boots','AttackSpeed']),
};

test('50 Riot drafts lock the correct champion and carry enemy-based plans into game',async()=>{
  const allNames=[...allyNames,...enemyNames.flat()];
  const nameById=new Map(allNames.map((name,index)=>[index+1,name]));
  const idByName=new Map(allNames.map((name,index)=>[name,index+1]));
  const byRole=new Map<string,Set<string>>();
  const buildsByRole=new Map<string,Set<string>>();
  for(let game=0;game<50;game++){
    const roleIndex=game%5,profileIndex=Math.floor(game/5),profile=profiles[profileIndex];
    const enemies=enemyNames[profileIndex];
    const localName=allyNames[roleIndex],localId=idByName.get(localName)!;
    const myTeam=allyNames.map((name,slot)=>({cellId:slot,championId:slot===roleIndex?0:idByName.get(name),
      selectedChampionId:slot===roleIndex?localId:0,assignedPosition:positions[slot]}));
    const theirTeam=enemies.map((name,slot)=>({cellId:slot+5,championId:idByName.get(name),assignedPosition:positions[slot]}));
    const lock={type:'pick',actorCellId:roleIndex,championId:0,selectedChampionId:localId,
      ...(game%3===0?{completed:true}:game%3===1?{isCompleted:true}:{selectionState:'LOCKED'})};
    const context=await normalizePregame({localPlayerCellId:roleIndex,myTeam,theirTeam,actions:[[lock]],timer:{phase:'FINALIZATION'}},
      async (id:number)=>nameById.get(id)||null);
    const draft=draftFromLocalContext(context);
    assert.equal(draft.localChampionName,localName,`game ${game}: selected champion`);
    assert.equal(draft.localRole,roles[roleIndex],`game ${game}: role`);
    assert.equal(draft.localSelectionState,'LOCKED',`game ${game}: lock state`);
    assert.equal(draft.enemies.length,5,`game ${game}: enemy roster`);
    assert.deepEqual(draft.enemies.map((pick:any)=>pick.championName),enemies,`game ${game}: enemy names`);

    const details=new Map<string,ChampionDetail>();
    allyNames.forEach((name,slot)=>details.set(name.toLowerCase(),champion(name,slot===3?'PHYSICAL':'BALANCED',slot)));
    enemies.forEach((name,slot)=>details.set(name.toLowerCase(),champion(name,profile,slot)));
    const allyPicks=draft.allies.map((pick:any)=>({name:pick.championName,role:pick.role,lockedIn:pick.lockedIn}));
    const enemyPicks=draft.enemies.map((pick:any)=>({name:pick.championName,role:pick.role,lockedIn:pick.lockedIn}));
    const base=buildPregameTeamPlan({localChampion:localName,localRole:roles[roleIndex],allies:allyPicks,enemies:enemyPicks,details,roster:{}});
    const strategy=buildCompositionStrategy({localChampion:localName,localRole:roles[roleIndex],allies:allyPicks,enemies:enemyPicks,details,baseRoleWinCondition:base.roleWinCondition});
    const you=details.get(localName.toLowerCase())!;
    const build=buildAdaptiveItemPlan({patch:'test',you,role:roles[roleIndex],
      allies:allyPicks.map((pick:any)=>({champion:pick.name,role:pick.role,detail:details.get(pick.name.toLowerCase())!})),
      enemies:enemyPicks.map((pick:any)=>({champion:pick.name,role:pick.role,detail:details.get(pick.name.toLowerCase())!})),items});
    assert.equal(base.known.enemies,5,`game ${game}: composition count`);
    assert.ok(strategy.ourWinCondition?.trim(),`game ${game}: our win condition`);
    assert.ok(strategy.roleWinCondition?.summary?.trim(),`game ${game}: role win condition`);
    assert.ok(strategy.roleWinCondition.steps.length>=3,`game ${game}: simple steps`);
    assert.ok(build.core.length>0,`game ${game}: champion build`);
    assert.equal(build.enemyProfile.physical+build.enemyProfile.magic+build.enemyProfile.mixed,5,`game ${game}: build enemy count`);
    const signatures=byRole.get(roles[roleIndex])||new Set<string>();
    signatures.add(`${strategy.roleWinCondition.summary}|${build.draftItem?.name||''}|${build.boots?.name||''}`);
    byRole.set(roles[roleIndex],signatures);
    const builds=buildsByRole.get(roles[roleIndex])||new Set<string>();
    builds.add(`${build.draftItem?.name||''}|${build.boots?.name||''}|${build.finish?.name||''}`);
    buildsByRole.set(roles[roleIndex],builds);

    const players=[...allyNames.map((championName,slot)=>({team:'ORDER',championName,position:positions[slot],riotId:`ally-${slot}`})),
      ...enemies.map((championName,slot)=>({team:'CHAOS',championName,position:positions[slot],riotId:`enemy-${slot}`}))];
    const recovered=recoveryPregameContext({active:{riotId:`ally-${roleIndex}`,championName:''},players});
    assert.equal(recovered?.localChampionName,localName,`game ${game}: in-game champion`);
    assert.deepEqual(recovered?.enemies.map((pick:any)=>pick.championName),enemies,`game ${game}: in-game enemies`);
  }
  for(const [role,signatures] of byRole)assert.ok(signatures.size>=2,`${role}: plans should react to enemy drafts`);
  for(const [role,builds] of buildsByRole)assert.ok(builds.size>=2,`${role}: item recommendations should react to enemy drafts`);
});
