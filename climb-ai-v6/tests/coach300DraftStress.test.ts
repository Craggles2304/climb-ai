import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import {evaluateWinConditionPlan} from '../lib/coachWinConditionEval';
import type {DraftRole,DraftRolePlayer} from '../lib/draftRoleResolver';

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const RANKS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER'] as const;
const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});

const POOLS={
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

function draft300(index:number){
  const a=index%10;
  const b=Math.floor(index/10)%10;
  const c=Math.floor(index/100)%10;
  const oi=[a,b,c,(a+2*b+3*c+1)%10,(3*a+b+2*c+4)%10];
  const ei=[(7*a+b+c+2)%10,(a+5*b+2*c+3)%10,(2*a+b+7*c+5)%10,(4*a+3*b+c+6)%10,(a+2*b+5*c+7)%10];
  const ours=ROLES.map((role,i)=>P(POOLS[role].ours[oi[i]],role));
  const enemies=ROLES.map((role,i)=>P(POOLS[role].enemies[ei[i]],role));
  return{ours,enemies};
}

function planText(plan:ReturnType<typeof buildRankAwareDraftPlan>){
  return [
    plan.headline,plan.why,plan.theirPlan,plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,
    plan.never,plan.ifBehind,plan.lanePlan.wave,plan.lanePlan.trade,plan.lanePlan.respect,
    ...plan.steps.map(step=>step.value),
  ].join(' ').toLowerCase();
}

test('300 additional unique drafts pass 1500 role-specific Iron-to-Master coaching cases',()=>{
  const signatures=new Set<string>();
  const rankCounts=new Map(RANKS.map(rank=>[rank,0]));
  const roleCounts=new Map(ROLES.map(role=>[role,0]));
  const perRank=new Map(RANKS.map(rank=>[rank,{cases:0,passes:0,total:0,min:100}]));
  let cases=0;
  let passes=0;

  for(let draftIndex=0;draftIndex<300;draftIndex++){
    const draft=draft300(draftIndex);
    const signature=[...draft.ours,...draft.enemies].map(player=>player.champion).join('|');
    assert.ok(!signatures.has(signature),'duplicate 10-champion draft at '+draftIndex);
    signatures.add(signature);

    const headlines=new Set<string>();
    for(let roleIndex=0;roleIndex<ROLES.length;roleIndex++){
      const role=ROLES[roleIndex];
      const rank=RANKS[(draftIndex*ROLES.length+roleIndex)%RANKS.length];
      const player=draft.ours.find(item=>item.role===role)!;
      const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:draft.ours,enemies:draft.enemies,rank});
      const all=planText(plan);
      headlines.add(plan.headline);
      cases++;
      roleCounts.set(role,(roleCounts.get(role)||0)+1);
      rankCounts.set(rank,(rankCounts.get(rank)||0)+1);

      const expectedLane=role==='ADC'||role==='SUPPORT'
        ?[draft.enemies.find(item=>item.role==='ADC')!.champion,draft.enemies.find(item=>item.role==='SUPPORT')!.champion]
        :[draft.enemies.find(item=>item.role===role)!.champion];

      assert.deepEqual(plan.laneOpponents,expectedLane,'draft '+draftIndex+' '+role+' wrong lane');
      assert.equal(plan.laneOpponent,expectedLane[0],'draft '+draftIndex+' '+role+' wrong primary lane opponent');
      assert.ok(plan.threats.length>=1&&plan.threats.length<=3,'draft '+draftIndex+' '+role+' threat count');
      assert.ok(plan.threats.every(name=>draft.enemies.some(enemy=>enemy.champion===name)),'draft '+draftIndex+' '+role+' threat hallucination');
      assert.ok(plan.threats.some(name=>plan.threatAnswer.toLowerCase().includes(name.toLowerCase())),'draft '+draftIndex+' '+role+' threat answer does not name threat');
      assert.equal(plan.steps.length,5,'draft '+draftIndex+' '+role+' must have five steps');
      assert.equal(new Set(plan.steps.map(step=>step.value)).size,5,'draft '+draftIndex+' '+role+' repeated win-path steps');
      assert.doesNotMatch(all,/play clean|play safe|stay connected|strongest engage|key spell misses|focus objectives/,'draft '+draftIndex+' '+role+' generic coaching leak');
      assert.match(plan.objectiveSetup.toLowerCase(),/arrive|entry|objective|river|vision|front edge|choke/,'draft '+draftIndex+' '+role+' lacks objective geometry');

      if(role==='ADC'){
        assert.match(all,/closest safe target|target accessibility|do not walk through/,'draft '+draftIndex+' ADC lacks target-access rule');
        assert.equal(plan.lanePartner,draft.ours.find(item=>item.role==='SUPPORT')!.champion,'draft '+draftIndex+' ADC partner');
      }
      if(role==='SUPPORT'){
        assert.equal(plan.lanePartner,draft.ours.find(item=>item.role==='ADC')!.champion,'draft '+draftIndex+' support partner');
        assert.ok(all.includes(draft.ours.find(item=>item.role==='ADC')!.champion.toLowerCase()),'draft '+draftIndex+' support plan ignores ADC');
      }
      if(role==='JUNGLE')assert.match(all,/path|objective|river|quadrant|camps|tempo/,'draft '+draftIndex+' jungle responsibility');
      if(role==='MID')assert.match(all,/mid|wave|push|move/,'draft '+draftIndex+' mid responsibility');
      if(role==='TOP')assert.match(all,/side|front|flank|wave/,'draft '+draftIndex+' top responsibility');

      const quality=evaluateWinConditionPlan({plan,ours:draft.ours,enemies:draft.enemies,rank,role});
      const bucket=perRank.get(rank)!;
      bucket.cases++;
      bucket.total+=quality.score;
      bucket.min=Math.min(bucket.min,quality.score);
      if(quality.pass){passes++;bucket.passes++;}
      else assert.fail('draft '+draftIndex+' '+role+' '+rank+' failed quality '+quality.score+': '+quality.issues.join('; '));
    }
    assert.ok(headlines.size>=3,'draft '+draftIndex+' collapsed all five roles into generic team coaching');
  }

  assert.equal(signatures.size,300,'must contain 300 additional unique drafts');
  assert.equal(cases,1500,'300 drafts x five roles must create 1500 coaching cases');
  assert.equal(passes,1500,'all 1500 role/rank cases must clear their quality gate');
  for(const role of ROLES)assert.equal(roleCounts.get(role),300,role+' must be tested in all 300 drafts');
  for(const rank of RANKS)assert.ok((rankCounts.get(rank)||0)>=187,rank+' coverage too low');

  console.log('COACH300 uniqueDrafts='+signatures.size+' roleCases='+cases+' qualityPasses='+passes+'/'+cases);
  for(const rank of RANKS){
    const b=perRank.get(rank)!;
    console.log('COACH300 '+rank+' avg='+(b.total/b.cases).toFixed(1)+' pass='+b.passes+'/'+b.cases+' min='+b.min);
  }
});
