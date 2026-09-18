import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import {evaluateWinConditionPlan} from '../lib/coachWinConditionEval';
import {resolvePlayerRole,type DraftRole,type DraftRolePlayer} from '../lib/draftRoleResolver';

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const RANKS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER'] as const;
const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});

const OFFMETA={
  TOP:{
    ours:['Vayne','Smolder','Karma','Lulu','Soraka','Zilean','Taric','Warwick','Rengar','Gragas'],
    enemies:['Ashe','Lucian','Tristana','Ryze','Cassiopeia','Teemo','Zac','Shaco','Udyr','Tahm Kench'],
  },
  JUNGLE:{
    ours:['Brand','Zyra','Morgana','Neeko','Nautilus','Blitzcrank','Shen','Sion','Kled','Riven'],
    enemies:['Darius','Garen',"Cho'Gath",'Malphite','Ornn','Braum','Leona','Janna','Bard','Twitch'],
  },
  MID:{
    ours:['Caitlyn','Jhin','Kalista','Draven','Miss Fortune','Aphelios','Ezreal','Sivir','Xayah',"Kog'Maw"],
    enemies:['Amumu','Sejuani','Maokai','Rammus','Nunu & Willump','Singed','Dr. Mundo','Nasus','Poppy',"Rek'Sai"],
  },
  ADC:{
    ours:['Seraphine','Ziggs','Swain','Karthus','Veigar','Hwei','Syndra','Viktor','Anivia','Aurelion Sol'],
    enemies:['Yasuo','Yone','Irelia','Pantheon','Sett','Gnar','Kennen','Jayce','Kayle','Azir'],
  },
  SUPPORT:{
    ours:['Camille','Fiora','Renekton','Jax','Olaf','Volibear','Nocturne','Hecarim','Master Yi',"Kha'Zix"],
    enemies:['Lee Sin','Graves','Kindred','Fiddlesticks','Lillia','Nidalee',"Bel'Veth",'Viego','Xin Zhao','Wukong'],
  },
} as const;

const NON_FRONT_TOP=new Set(['Vayne','Smolder','Karma','Lulu','Soraka','Zilean','Ashe','Lucian','Tristana','Ryze','Cassiopeia','Teemo']);
const SELFISH_SUPPORT=new Set(['Fiora','Jax','Olaf','Master Yi',"Kha'Zix"]);

function offMetaDraft(index:number){
  const a=index%10;
  const b=Math.floor(index/10)%10;
  const c=Math.floor(index/100)%2;
  const oi=[a,b,(a+b+3*c+1)%10,(2*a+b+5*c+2)%10,(a+3*b+7*c+3)%10];
  const ei=[(3*a+b+c+4)%10,(a+5*b+2*c+5)%10,(2*a+3*b+7*c+6)%10,(4*a+b+3*c+7)%10,(a+2*b+5*c+8)%10];
  return{
    ours:ROLES.map((role,i)=>P(OFFMETA[role].ours[oi[i]],role)),
    enemies:ROLES.map((role,i)=>P(OFFMETA[role].enemies[ei[i]],role)),
  };
}

function text(plan:ReturnType<typeof buildRankAwareDraftPlan>){
  return [
    plan.headline,plan.why,plan.theirPlan,plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,
    plan.never,plan.ifBehind,plan.lanePlan.wave,plan.lanePlan.trade,plan.lanePlan.respect,
    ...plan.steps.map(step=>step.value),
  ].join(' ').toLowerCase();
}

test('200 weird off-meta drafts produce 1000 role-specific coaching cases',()=>{
  const signatures=new Set<string>();
  const rankCounts=new Map(RANKS.map(rank=>[rank,0]));
  const roleCounts=new Map(ROLES.map(role=>[role,0]));
  let cases=0;
  let passes=0;

  for(let draftIndex=0;draftIndex<200;draftIndex++){
    const draft=offMetaDraft(draftIndex);
    const signature=[...draft.ours,...draft.enemies].map(player=>player.champion).join('|');
    assert.ok(!signatures.has(signature),'duplicate off-meta draft '+draftIndex);
    signatures.add(signature);

    const headlines=new Set<string>();
    for(let roleIndex=0;roleIndex<ROLES.length;roleIndex++){
      const role=ROLES[roleIndex];
      const rank=RANKS[(draftIndex*5+roleIndex)%RANKS.length];
      const player=draft.ours.find(item=>item.role===role)!;
      const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:draft.ours,enemies:draft.enemies,rank});
      const all=text(plan);
      headlines.add(plan.headline);
      cases++;
      roleCounts.set(role,(roleCounts.get(role)||0)+1);
      rankCounts.set(rank,(rankCounts.get(rank)||0)+1);

      const expectedLane=role==='ADC'||role==='SUPPORT'
        ?[draft.enemies.find(item=>item.role==='ADC')!.champion,draft.enemies.find(item=>item.role==='SUPPORT')!.champion]
        :[draft.enemies.find(item=>item.role===role)!.champion];

      assert.deepEqual(plan.laneOpponents,expectedLane,'off-meta '+draftIndex+' '+role+' lane');
      assert.equal(plan.laneOpponent,expectedLane[0],'off-meta '+draftIndex+' '+role+' primary lane');
      assert.ok(plan.threats.length>=1&&plan.threats.length<=3,'off-meta '+draftIndex+' threat count');
      assert.ok(plan.threats.every(name=>draft.enemies.some(enemy=>enemy.champion===name)),'off-meta '+draftIndex+' threat hallucination');
      assert.ok(plan.threats.some(name=>plan.threatAnswer.toLowerCase().includes(name.toLowerCase())),'off-meta '+draftIndex+' threat response');
      assert.equal(plan.steps.length,5,'off-meta '+draftIndex+' '+role+' five steps');
      assert.equal(new Set(plan.steps.map(step=>step.value)).size,5,'off-meta '+draftIndex+' '+role+' repeated steps');
      assert.doesNotMatch(all,/play clean|play safe|stay connected|strongest engage|key spell misses|focus objectives/,'off-meta '+draftIndex+' generic coaching');
      assert.match(plan.objectiveSetup.toLowerCase(),/arrive|entry|objective|river|vision|front edge|choke/,'off-meta '+draftIndex+' objective geometry');

      if(role==='TOP'&&NON_FRONT_TOP.has(player.champion)){
        assert.doesNotMatch(plan.headline,/HOLD FRONT EDGE/,'off-meta '+draftIndex+' squishy/ranged top told to front line');
        assert.doesNotMatch(all,/stand between .* and .*carry/,'off-meta '+draftIndex+' squishy/ranged top assigned tank duty');
      }
      if(role==='ADC'){
        assert.equal(plan.lanePartner,draft.ours.find(item=>item.role==='SUPPORT')!.champion,'off-meta '+draftIndex+' APC partner');
        assert.deepEqual(plan.laneOpponents,expectedLane,'off-meta '+draftIndex+' bot duo');
        assert.match(all,/closest safe target|target accessibility|do not walk through/,'off-meta '+draftIndex+' bot carry target-access rule');
      }
      if(role==='SUPPORT'){
        assert.equal(plan.lanePartner,draft.ours.find(item=>item.role==='ADC')!.champion,'off-meta '+draftIndex+' support partner');
        assert.ok(all.includes(draft.ours.find(item=>item.role==='ADC')!.champion.toLowerCase()),'off-meta '+draftIndex+' support ignores lane carry');
        if(SELFISH_SUPPORT.has(player.champion)){
          assert.doesNotMatch(plan.headline,/PROTECT THE EXIT|PROTECT CARRY/,'off-meta '+draftIndex+' selfish fighter support falsely presented as peel');
        }
      }
      if(role==='JUNGLE')assert.match(all,/path|objective|river|quadrant|camps|tempo/,'off-meta '+draftIndex+' jungle map responsibility');
      if(role==='MID')assert.match(all,/mid|wave|push|move/,'off-meta '+draftIndex+' mid wave responsibility');

      const quality=evaluateWinConditionPlan({plan,ours:draft.ours,enemies:draft.enemies,rank,role});
      if(quality.pass)passes++;
      else assert.fail('off-meta '+draftIndex+' '+player.champion+' '+role+' '+rank+' failed quality '+quality.score+': '+quality.issues.join('; '));
    }
    assert.ok(headlines.size>=3,'off-meta draft '+draftIndex+' collapsed all roles into same coaching identity');
  }

  assert.equal(signatures.size,200);
  assert.equal(cases,1000);
  assert.equal(passes,1000);
  for(const role of ROLES)assert.equal(roleCounts.get(role),200,role+' off-meta coverage');
  for(const rank of RANKS)assert.equal(rankCounts.get(rank),125,rank+' off-meta coverage');
  console.log('COACH200_OFFMETA uniqueDrafts='+signatures.size+' roleCases='+cases+' qualityPasses='+passes+'/'+cases);
});

test('explicit weird role assignment always beats champion prior',()=>{
  const cases:Array<[string,DraftRole,string]>=[
    ['Vayne','TOP','ADC'],['Smolder','TOP','ADC'],['Brand','JUNGLE','MID'],['Nautilus','JUNGLE','SUPPORT'],
    ['Caitlyn','MID','ADC'],['Aphelios','MID','ADC'],['Seraphine','ADC','SUPPORT'],['Ziggs','ADC','MID'],
    ['Camille','SUPPORT','TOP'],['Fiora','SUPPORT','TOP'],["Kha'Zix",'SUPPORT','JUNGLE'],['Master Yi','SUPPORT','JUNGLE'],
  ];
  for(const [champion,assignedRole,profileRole] of cases){
    const ours=ROLES.map(role=>P(role===assignedRole?champion:({
      TOP:'Ornn',JUNGLE:'Sejuani',MID:'Orianna',ADC:'Jinx',SUPPORT:'Lulu',
    } as Record<DraftRole,string>)[role],role));
    const resolved=resolvePlayerRole({champion,requestRole:assignedRole,profileRole,ours,gameMode:'CLASSIC'});
    assert.equal(resolved.role,assignedRole,champion+' off-meta role must beat profile/champion prior');
    assert.equal(resolved.source,'REQUEST');
    assert.equal(resolved.confidence,'HIGH');
  }
});
