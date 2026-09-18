import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import {evaluateWinConditionPlan} from '../lib/coachWinConditionEval';
import type {DraftRole,DraftRolePlayer} from '../lib/draftRoleResolver';

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const RANKS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER'] as const;
const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});

const drafts=[
  {
    name:'protect Jinx into dive',
    ours:[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')],
    enemies:[P('Camille','TOP'),P('Vi','JUNGLE'),P('Akali','MID'),P("Kai'Sa",'ADC'),P('Nautilus','SUPPORT')],
    threats:['Camille','Vi','Akali','Nautilus'],
  },
  {
    name:'Nocturne Ahri catch',
    ours:[P('Shen','TOP'),P('Nocturne','JUNGLE'),P('Ahri','MID'),P('Jhin','ADC'),P('Nautilus','SUPPORT')],
    enemies:[P('Sion','TOP'),P('Graves','JUNGLE'),P('Viktor','MID'),P('Xayah','ADC'),P('Rakan','SUPPORT')],
    threats:['Rakan','Sion'],
  },
  {
    name:'long range poke',
    ours:[P('Jayce','TOP'),P('Nidalee','JUNGLE'),P('Zoe','MID'),P('Varus','ADC'),P('Karma','SUPPORT')],
    enemies:[P('Ornn','TOP'),P('Maokai','JUNGLE'),P('Azir','MID'),P('Aphelios','ADC'),P('Lulu','SUPPORT')],
    threats:['Ornn','Maokai'],
  },
  {
    name:'Camille side catch',
    ours:[P('Camille','TOP'),P('Vi','JUNGLE'),P('Ahri','MID'),P('Jinx','ADC'),P('Thresh','SUPPORT')],
    enemies:[P('Ornn','TOP'),P('Xin Zhao','JUNGLE'),P('Viktor','MID'),P('Sivir','ADC'),P('Braum','SUPPORT')],
    threats:['Xin Zhao','Ornn','Braum'],
  },
  {
    name:'scaling into early snowball',
    ours:[P('Kayle','TOP'),P('Master Yi','JUNGLE'),P('Kassadin','MID'),P('Sivir','ADC'),P('Soraka','SUPPORT')],
    enemies:[P('Renekton','TOP'),P('Elise','JUNGLE'),P('Pantheon','MID'),P('Draven','ADC'),P('Leona','SUPPORT')],
    threats:['Renekton','Elise','Pantheon','Leona'],
  },
  {
    name:'Renekton Jarvan Diana dive',
    ours:[P('Renekton','TOP'),P('Jarvan IV','JUNGLE'),P('Diana','MID'),P('Samira','ADC'),P('Rell','SUPPORT')],
    enemies:[P('Gnar','TOP'),P('Lillia','JUNGLE'),P('Hwei','MID'),P('Jinx','ADC'),P('Milio','SUPPORT')],
    threats:['Gnar'],
  },
  {
    name:'balanced front to back',
    ours:[P('Sion','TOP'),P('Xin Zhao','JUNGLE'),P('Viktor','MID'),P('Sivir','ADC'),P('Braum','SUPPORT')],
    enemies:[P('Aatrox','TOP'),P('Graves','JUNGLE'),P('Syndra','MID'),P('Xayah','ADC'),P('Milio','SUPPORT')],
    threats:['Aatrox'],
  },
  {
    name:'Xerath Ezreal poke',
    ours:[P('Gragas','TOP'),P('Lee Sin','JUNGLE'),P('Xerath','MID'),P('Ezreal','ADC'),P('Janna','SUPPORT')],
    enemies:[P('Mordekaiser','TOP'),P('Karthus','JUNGLE'),P('Aurelion Sol','MID'),P('Sivir','ADC'),P('Soraka','SUPPORT')],
    threats:['Mordekaiser','Aurelion Sol'],
  },
  {
    name:'Malphite Amumu wombo',
    ours:[P('Malphite','TOP'),P('Amumu','JUNGLE'),P('Orianna','MID'),P("Kai'Sa",'ADC'),P('Alistar','SUPPORT')],
    enemies:[P('Fiora','TOP'),P('Kindred','JUNGLE'),P('Viktor','MID'),P('Ezreal','ADC'),P('Janna','SUPPORT')],
    threats:['Fiora'],
  },
  {
    name:'KogMaw protect into assassins',
    ours:[P('Ornn','TOP'),P('Kindred','JUNGLE'),P('Zilean','MID'),P("Kog'Maw",'ADC'),P('Braum','SUPPORT')],
    enemies:[P('Camille','TOP'),P('Hecarim','JUNGLE'),P('Zed','MID'),P('Jhin','ADC'),P('Nautilus','SUPPORT')],
    threats:['Camille','Hecarim','Zed','Nautilus'],
  },
  {
    name:'anti-dive Poppy Taliyah Janna',
    ours:[P('Poppy','TOP'),P('Maokai','JUNGLE'),P('Taliyah','MID'),P('Xayah','ADC'),P('Janna','SUPPORT')],
    enemies:[P('Jax','TOP'),P('Hecarim','JUNGLE'),P('Yone','MID'),P('Samira','ADC'),P('Rakan','SUPPORT')],
    threats:['Jax','Hecarim','Yone','Rakan'],
  },
  {
    name:'Fiora side lane with Nocturne TF',
    ours:[P('Fiora','TOP'),P('Nocturne','JUNGLE'),P('Twisted Fate','MID'),P('Ezreal','ADC'),P('Bard','SUPPORT')],
    enemies:[P('Ornn','TOP'),P('Sejuani','JUNGLE'),P('Azir','MID'),P('Jinx','ADC'),P('Lulu','SUPPORT')],
    threats:['Ornn','Sejuani'],
  },
  {
    name:'Jayce Ziggs Caitlyn siege',
    ours:[P('Jayce','TOP'),P('Gragas','JUNGLE'),P('Ziggs','MID'),P('Caitlyn','ADC'),P('Lux','SUPPORT')],
    enemies:[P('Dr. Mundo','TOP'),P('Graves','JUNGLE'),P('Vladimir','MID'),P('Sivir','ADC'),P('Soraka','SUPPORT')],
    threats:['Dr. Mundo','Vladimir'],
  },
  {
    name:'Kennen Wukong Orianna choke',
    ours:[P('Kennen','TOP'),P('Wukong','JUNGLE'),P('Orianna','MID'),P('Miss Fortune','ADC'),P('Rakan','SUPPORT')],
    enemies:[P('Gwen','TOP'),P('Lee Sin','JUNGLE'),P('Ahri','MID'),P('Ezreal','ADC'),P('Janna','SUPPORT')],
    threats:['Gwen','Lee Sin','Ahri'],
  },
  {
    name:'Ashe Blitz pick',
    ours:[P('Kled','TOP'),P('Elise','JUNGLE'),P('Syndra','MID'),P('Ashe','ADC'),P('Blitzcrank','SUPPORT')],
    enemies:[P('Sion','TOP'),P('Karthus','JUNGLE'),P('Viktor','MID'),P('Jinx','ADC'),P('Soraka','SUPPORT')],
    threats:['Sion'],
  },
  {
    name:'Shen Ivern Lulu protect KogMaw',
    ours:[P('Shen','TOP'),P('Ivern','JUNGLE'),P('Lulu','MID'),P("Kog'Maw",'ADC'),P('Braum','SUPPORT')],
    enemies:[P('Camille','TOP'),P('Nocturne','JUNGLE'),P('Akali','MID'),P('Jhin','ADC'),P('Leona','SUPPORT')],
    threats:['Camille','Nocturne','Akali','Leona'],
  },
  {
    name:'Nocturne Diana Rakan collapse',
    ours:[P('Renekton','TOP'),P('Nocturne','JUNGLE'),P('Diana','MID'),P("Kai'Sa",'ADC'),P('Rakan','SUPPORT')],
    enemies:[P('Gnar','TOP'),P('Kindred','JUNGLE'),P('Orianna','MID'),P('Jinx','ADC'),P('Milio','SUPPORT')],
    threats:['Gnar'],
  },
  {
    name:'Rumble Fiddlesticks Anivia zone',
    ours:[P('Rumble','TOP'),P('Fiddlesticks','JUNGLE'),P('Anivia','MID'),P('Sivir','ADC'),P('Alistar','SUPPORT')],
    enemies:[P('Fiora','TOP'),P('Lee Sin','JUNGLE'),P('LeBlanc','MID'),P('Ezreal','ADC'),P('Janna','SUPPORT')],
    threats:['Fiora','Lee Sin','LeBlanc'],
  },
  {
    name:'low-engage scaling front line',
    ours:[P('Dr. Mundo','TOP'),P('Graves','JUNGLE'),P('Viktor','MID'),P('Xayah','ADC'),P('Milio','SUPPORT')],
    enemies:[P('Renekton','TOP'),P('Jarvan IV','JUNGLE'),P('Syndra','MID'),P('Lucian','ADC'),P('Nami','SUPPORT')],
    threats:['Renekton','Jarvan IV'],
  },
  {
    name:'Aphelios Rakan into Sett Pantheon Irelia',
    ours:[P('Ashe','TOP'),P('Nasus','JUNGLE'),P('Kassadin','MID'),P('Aphelios','ADC'),P('Rakan','SUPPORT')],
    enemies:[P('Sett','TOP'),P('Pantheon','JUNGLE'),P('Irelia','MID'),P('Lucian','ADC'),P('Taric','SUPPORT')],
    threats:['Sett','Pantheon','Irelia'],
  },
] as const;

test('100 torture cases resolve role, lane and threats',()=>{
  let cases=0;
  for(const draft of drafts){
    for(const role of ROLES){
      cases++;
      const player=draft.ours.find(p=>p.role===role)!;
      const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank:'PLATINUM'});
      const enemyRole=role==='ADC'||role==='SUPPORT'?'ADC':role;
      const expected=draft.enemies.find(p=>p.role===enemyRole)!.champion;
      assert.equal(plan.laneOpponent,expected,draft.name+' '+role+' lane');
      assert.ok(plan.threats.some(name=>(draft.threats as readonly string[]).includes(name)),draft.name+' '+role+' threat');
      assert.equal(plan.steps.length,5);
    }
  }
  assert.equal(cases,100);
});


test('100-case torture bench rejects generic coaching and covers Iron through Master',()=>{
  let caseIndex=0;
  const rankCounts=new Map(RANKS.map(rank=>[rank,0]));
  const scores:number[]=[];
  let qualityPasses=0;
  const perRank=new Map(RANKS.map(rank=>[rank,{cases:0,passes:0,total:0,min:100,issues:new Map<string,number>()}]));
  for(const draft of drafts){
    for(const role of ROLES){
      const rank=RANKS[caseIndex%RANKS.length];
      rankCounts.set(rank,(rankCounts.get(rank)||0)+1);
      const player=draft.ours.find(p=>p.role===role)!;
      const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank});
      const all=[plan.headline,plan.why,plan.theirPlan,plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,plan.never,plan.ifBehind,plan.lanePlan.wave,plan.lanePlan.trade,plan.lanePlan.respect,...plan.steps.map(step=>step.value)].join(' ').toLowerCase();
      assert.doesNotMatch(all,/play clean|play safe|stay connected|strongest engage|key spell misses|focus objectives/,draft.name+' '+role+' generic');
      assert.ok(/arrive|entry|objective|river|vision|front edge|choke/.test(plan.objectiveSetup.toLowerCase()),draft.name+' '+role+' objective geometry');
      assert.ok(plan.threats.some(name=>plan.threatAnswer.toLowerCase().includes(name.toLowerCase())),draft.name+' '+role+' threat answer');
      if(role==='ADC'){
        assert.match(all,/closest safe target|target accessibility|do not walk through/,draft.name+' ADC target rule');
        assert.equal(plan.lanePartner,draft.ours.find(p=>p.role==='SUPPORT')!.champion,draft.name+' ADC partner');
        assert.deepEqual(plan.laneOpponents,[draft.enemies.find(p=>p.role==='ADC')!.champion,draft.enemies.find(p=>p.role==='SUPPORT')!.champion],draft.name+' bot duo');
      }
      if(role==='SUPPORT'){
        assert.equal(plan.lanePartner,draft.ours.find(p=>p.role==='ADC')!.champion,draft.name+' support partner');
        assert.ok(all.includes(draft.ours.find(p=>p.role==='ADC')!.champion.toLowerCase()),draft.name+' support ignores ADC');
      }
      if(role==='JUNGLE')assert.match(all,/path|objective|river|quadrant|camps|tempo/,draft.name+' jungle responsibility');
      if(role==='MID')assert.match(all,/mid|wave|push|move/,draft.name+' mid responsibility');
      if(role==='TOP')assert.match(all,/side|front|flank|wave/,draft.name+' top responsibility');
      const quality=evaluateWinConditionPlan({plan,ours:[...draft.ours],enemies:[...draft.enemies],rank,role});
      scores.push(quality.score);
      if(!quality.pass)console.log('COACH100_FAIL '+draft.name+' '+role+' '+rank+' score='+quality.score+' issues='+quality.issues.join('; '));
      if(quality.pass)qualityPasses++;
      const bucket=perRank.get(rank)!;
      bucket.cases++;bucket.total+=quality.score;bucket.min=Math.min(bucket.min,quality.score);if(quality.pass)bucket.passes++;for(const issue of quality.issues)bucket.issues.set(issue,(bucket.issues.get(issue)||0)+1);
      caseIndex++;
    }
  }
  assert.equal(caseIndex,100);
  for(const rank of RANKS)assert.ok((rankCounts.get(rank)||0)>=12,rank+' coverage');
  const average=scores.reduce((sum,score)=>sum+score,0)/scores.length;
  console.log('COACH100 average='+average.toFixed(1)+' qualityPasses='+qualityPasses+'/100');
  for(const rank of RANKS){const b=perRank.get(rank)!;const issues=[...b.issues.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>v+'x '+k).join(' | ');console.log('COACH100 '+rank+' avg='+(b.total/b.cases).toFixed(1)+' pass='+b.passes+'/'+b.cases+' min='+b.min+' issues='+issues);}
  assert.ok(average>=70,'100-case average rank quality below 70: '+average.toFixed(1));
});

test('same draft produces role-specific coaching instead of one generic team sentence',()=>{
  const draft=drafts[0];
  const plans=ROLES.map(role=>{
    const player=draft.ours.find(p=>p.role===role)!;
    return buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank:'PLATINUM'});
  });
  assert.ok(new Set(plans.map(plan=>plan.headline)).size>=3,'headlines are not role-specific');
  const adc=plans[3];
  const support=plans[4];
  assert.match(adc.headline,/SURVIVE|ABSORB/);
  assert.match(support.headline,/CREATE|PROTECT/);
  assert.notEqual(adc.fightTrigger,support.fightTrigger);
});


const GENERATED_POOLS={
  TOP:{
    ours:['Ornn','Shen','Camille','Fiora','Malphite','Renekton','Poppy','Kennen','Gwen','Dr. Mundo'],
    enemies:['Sett','Jax','Sion','Aatrox','Kled','Yorick','Rumble','Gnar','Volibear','Kayle'],
  },
  JUNGLE:{
    ours:['Sejuani','Nocturne','Vi','Jarvan IV','Amumu','Kindred','Fiddlesticks','Lee Sin','Graves','Maokai'],
    enemies:['Hecarim','Xin Zhao','Elise','Pantheon','Wukong','Lillia','Karthus','Nidalee',"Rek'Sai",'Skarner'],
  },
  MID:{
    ours:['Orianna','Ahri','Viktor','Kassadin','Zoe','Taliyah','Lissandra','Anivia','Diana','Syndra'],
    enemies:['Akali','Zed','Azir','Hwei','Vladimir','Yone','LeBlanc','Twisted Fate','Veigar','Aurelion Sol'],
  },
  ADC:{
    ours:['Jinx','Jhin','Varus','Aphelios','Xayah','Ezreal','Sivir',"Kog'Maw","Kai'Sa",'Caitlyn'],
    enemies:['Lucian','Draven','Samira','Miss Fortune','Ashe','Zeri','Twitch','Smolder','Kalista','Tristana'],
  },
  SUPPORT:{
    ours:['Lulu','Nautilus','Rakan','Braum','Janna','Thresh','Rell','Karma','Milio','Alistar'],
    enemies:['Leona','Taric','Sona','Soraka','Blitzcrank','Renata Glasc','Nami','Pyke','Tahm Kench','Morgana'],
  },
} as const;

function generatedDraft(index:number){
  const u=index%10;
  const t=Math.floor(index/10);
  const oi=[u+t,u+2*t+1,2*u+t+2,3*u+t+3,u+3*t+4].map(value=>value%10);
  const ei=[3*u+t+4,u+4*t+2,2*u+3*t+1,u+2*t+5,4*u+t+3].map(value=>value%10);
  const ours=ROLES.map((role,ri)=>P(GENERATED_POOLS[role].ours[oi[ri]],role));
  const enemies=ROLES.map((role,ri)=>P(GENERATED_POOLS[role].enemies[ei[ri]],role));
  return{ours,enemies};
}

test('100 unique generated drafts survive the full Iron-to-Master coaching contract',()=>{
  const signatures=new Set<string>();
  let passes=0;
  for(let index=0;index<100;index++){
    const draft=generatedDraft(index);
    const signature=[...draft.ours,...draft.enemies].map(player=>player.champion).join('|');
    signatures.add(signature);
    const role=ROLES[index%ROLES.length];
    const rank=RANKS[index%RANKS.length];
    const player=draft.ours.find(item=>item.role===role)!;
    const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:draft.ours,enemies:draft.enemies,rank});
    const expectedLane=role==='ADC'||role==='SUPPORT'
      ?[draft.enemies.find(item=>item.role==='ADC')!.champion,draft.enemies.find(item=>item.role==='SUPPORT')!.champion]
      :[draft.enemies.find(item=>item.role===role)!.champion];
    assert.deepEqual(plan.laneOpponents,expectedLane,'generated '+index+' '+role+' lane');
    assert.ok(plan.threats.every(name=>draft.enemies.some(enemy=>enemy.champion===name)),'generated '+index+' threat hallucination');
    assert.equal(plan.steps.length,5,'generated '+index+' steps');
    assert.equal(new Set(plan.steps.map(step=>step.value)).size,5,'generated '+index+' repeated steps');
    assert.ok(plan.threats.some(name=>plan.threatAnswer.toLowerCase().includes(name.toLowerCase())),'generated '+index+' threat response');
    const all=[plan.headline,plan.why,plan.theirPlan,plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,plan.never,plan.ifBehind,plan.lanePlan.wave,plan.lanePlan.trade,plan.lanePlan.respect,...plan.steps.map(step=>step.value)].join(' ').toLowerCase();
    assert.doesNotMatch(all,/play clean|play safe|stay connected|strongest engage|key spell misses|focus objectives/,'generated '+index+' generic');
    if(role==='ADC')assert.match(all,/closest safe target|target accessibility|do not walk through/,'generated '+index+' ADC target access');
    const quality=evaluateWinConditionPlan({plan,ours:draft.ours,enemies:draft.enemies,rank,role});
    if(quality.pass)passes++;
    else assert.fail('generated '+index+' '+role+' '+rank+' failed quality '+quality.score+': '+quality.issues.join('; '));
  }
  assert.equal(signatures.size,100,'generated benchmark must contain 100 unique 10-champion drafts');
  assert.equal(passes,100,'all 100 unique drafts must clear the rank-specific quality gate');
  console.log('COACH100_UNIQUE uniqueDrafts='+signatures.size+' qualityPasses='+passes+'/100');
});
