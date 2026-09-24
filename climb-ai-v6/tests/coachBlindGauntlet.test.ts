import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import type {DraftRole,DraftRolePlayer} from '../lib/draftRoleResolver';

/**
 * BLIND COACHING GAUNTLET
 *
 * This benchmark is intentionally independent of coachingLevel.ts and
 * coachWinConditionEval.ts. It does not import rank thresholds, coach rubrics,
 * archetype tables or engine internals. The fixtures and pass/fail contract live
 * here so the production coach cannot pass by reusing its own marking scheme.
 *
 * 20 fixed drafts x 5 player roles = 100 situations.
 * Every situation is replayed at the exact same seven ranks = 700 outputs.
 */

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const RANKS=['IRON','SILVER','GOLD','EMERALD','DIAMOND','MASTER','CHALLENGER'] as const;
type GauntletRank=typeof RANKS[number];

const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});
const D=(name:string,ours:string[],enemies:string[])=>({
  name,
  ours:ROLES.map((role,index)=>P(ours[index],role)),
  enemies:ROLES.map((role,index)=>P(enemies[index],role)),
});

const DRAFTS=[
  D('protect-hypercarry',['Ornn','Sejuani','Orianna','Jinx','Lulu'],['Camille','Nocturne','Zed',"Kai'Sa",'Rakan']),
  D('front-to-back',['Shen','Maokai','Viktor','Aphelios','Braum'],['Gwen','Vi','Syndra','Xayah','Nautilus']),
  D('poke-entry',['Kennen','Nidalee','Zoe','Varus','Karma'],['Malphite','Jarvan IV','Ahri','Ezreal','Leona']),
  D('pick-map',['Camille','Nocturne','Twisted Fate','Jhin','Thresh'],['Ornn','Sejuani','Viktor','Jinx','Milio']),
  D('hard-dive',['Renekton','Wukong','Diana',"Kai'Sa",'Rell'],['Poppy','Kindred','Anivia','Xayah','Janna']),
  D('scale-vs-early',['Kayle','Karthus','Aurelion Sol','Smolder','Sona'],['Kled',"Rek'Sai",'LeBlanc','Draven','Pyke']),
  D('side-catch',['Fiora','Vi','Ahri','Caitlyn','Nautilus'],['Sion','Lillia','Orianna','Jinx','Lulu']),
  D('zone-control',['Gnar','Fiddlesticks','Anivia','Varus','Renata Glasc'],['Camille','Hecarim','Akali','Lucian','Nami']),
  D('double-frontline',['Malphite','Amumu','Lissandra','Miss Fortune','Alistar'],['Gwen','Kindred','Azir','Zeri','Milio']),
  D('range-vs-engage',['Vayne','Graves','Hwei','Ezreal','Karma'],['Ornn','Sejuani','Yone','Samira','Leona']),
  D('reset-denial',['Poppy','Jarvan IV','Orianna','Jinx','Taric'],['Jax','Fiddlesticks','Vladimir','Twitch','Renata Glasc']),
  D('split-pressure',['Jax','Nocturne','Taliyah','Sivir','Rakan'],['Shen','Maokai','Syndra','Ashe','Braum']),
  D('catch-and-convert',['Sett','Vi','Lissandra','Jhin','Blitzcrank'],['Kayle','Karthus','Viktor','Smolder','Tahm Kench']),
  D('anti-dive',['Shen','Poppy','Orianna',"Kog'Maw",'Janna'],['Camille','Hecarim','Akali','Tristana','Rell']),
  D('tempo-skirmish',['Renekton','Lee Sin','Ahri','Lucian','Nami'],['Gnar','Lillia','Viktor','Aphelios','Thresh']),
  D('objective-zone',['Ornn','Fiddlesticks','Viktor','Ashe','Milio'],['Fiora','Nocturne','LeBlanc','Caitlyn','Pyke']),
  D('side-range',['Kennen','Sejuani','Taliyah','Jhin','Braum'],['Jax','Graves','Azir','Zeri','Karma']),
  D('protect-smolder',['Sion','Maokai','Anivia','Smolder','Lulu'],['Gwen','Vi','Diana','Draven','Nautilus']),
  D('fast-pick',['Camille','Elise','Ahri','Kalista','Thresh'],['Malphite','Amumu','Vladimir','Sivir','Janna']),
  D('mixed-access',['Gnar','Wukong','Syndra','Xayah','Rakan'],['Kled','Nocturne','Zoe','Jinx','Leona']),
] as const;

const KNOWN_CHAMPIONS=[...new Set(DRAFTS.flatMap(draft=>[
  ...draft.ours.map(player=>player.champion),
  ...draft.enemies.map(player=>player.champion),
]))];

const EXPERT_CONCEPTS=[
  'opportunity cost',
  'information state',
  'resource trade-off',
  'resource tradeoff',
  'option value',
  'map trade',
  'second access tool',
  'access chain',
  'tempo window',
  'decision threshold',
];

const CONDITIONAL=/\b(if|when|after|before|until|once|only when|as soon as|unless|while)\b/gi;

function text(plan:ReturnType<typeof buildRankAwareDraftPlan>){
  return [
    plan.headline,plan.why,plan.theirPlan,plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,
    plan.never,plan.ifBehind,plan.lanePlan.wave,plan.lanePlan.trade,plan.lanePlan.respect,
    ...plan.steps.map(step=>step.value),
  ].join(' ').replace(/\s+/g,' ').trim();
}

function decisionText(plan:ReturnType<typeof buildRankAwareDraftPlan>){
  return [plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,plan.never,plan.ifBehind]
    .join(' ').replace(/\s+/g,' ').trim();
}

function conditionalCount(value:string){
  const matches=value.toLowerCase().match(CONDITIONAL);
  return matches?.length??0;
}

function expertConcepts(value:string){
  const lower=value.toLowerCase();
  return EXPERT_CONCEPTS.filter(concept=>lower.includes(concept));
}

function esc(value:string){return value.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')}

function mentionsChampion(value:string,champion:string){
  const pattern=new RegExp('(?:^|[^a-z0-9])'+esc(champion.toLowerCase())+'(?:$|[^a-z0-9])','i');
  return pattern.test(value.toLowerCase());
}

function unexpectedChampionMentions(value:string,allowed:Set<string>){
  return KNOWN_CHAMPIONS.filter(champion=>!allowed.has(champion)&&mentionsChampion(value,champion));
}

function tokens(value:string){
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(token=>token.length>=3));
}

function jaccard(a:string,b:string){
  const left=tokens(a),right=tokens(b);
  const union=new Set([...left,...right]);
  if(!union.size)return 1;
  let intersection=0;
  for(const token of left)if(right.has(token))intersection++;
  return intersection/union.size;
}

function fingerprint(plan:ReturnType<typeof buildRankAwareDraftPlan>){
  return JSON.stringify({
    headline:plan.headline,
    why:plan.why,
    theirPlan:plan.theirPlan,
    threatAnswer:plan.threatAnswer,
    fightTrigger:plan.fightTrigger,
    objectiveSetup:plan.objectiveSetup,
    never:plan.never,
    ifBehind:plan.ifBehind,
    lanePlan:plan.lanePlan,
    steps:plan.steps,
  });
}

test('Blind Coaching Gauntlet contains 100 independently fixed situations',()=>{
  assert.equal(DRAFTS.length,20);
  assert.equal(DRAFTS.length*ROLES.length,100);
  for(const draft of DRAFTS){
    assert.equal(draft.ours.length,5,draft.name+' ally count');
    assert.equal(draft.enemies.length,5,draft.name+' enemy count');
    assert.equal(new Set([...draft.ours,...draft.enemies].map(player=>player.champion)).size,10,draft.name+' must use ten distinct champions');
  }
});

test('700 same-situation rank outputs stay grounded and never invent a champion interaction',()=>{
  let outputs=0;
  for(const draft of DRAFTS){
    const allowed=new Set([...draft.ours,...draft.enemies].map(player=>player.champion));
    for(const role of ROLES){
      const player=draft.ours.find(item=>item.role===role)!;
      for(const rank of RANKS){
        const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank});
        const all=text(plan);
        outputs++;
        assert.ok(plan.threats.every(name=>draft.enemies.some(enemy=>enemy.champion===name)),draft.name+' '+role+' '+rank+' invented threat');
        assert.ok(!plan.laneOpponent||draft.enemies.some(enemy=>enemy.champion===plan.laneOpponent),draft.name+' '+role+' '+rank+' invented lane opponent');
        assert.ok(!plan.lanePartner||draft.ours.some(ally=>ally.champion===plan.lanePartner),draft.name+' '+role+' '+rank+' invented lane partner');
        const unexpected=unexpectedChampionMentions(all,allowed);
        assert.deepEqual(unexpected,[],draft.name+' '+role+' '+rank+' mentioned out-of-draft champion(s): '+unexpected.join(', '));
      }
    }
  }
  assert.equal(outputs,700);
});

test('Iron never receives expert concepts or branch overload',()=>{
  for(const draft of DRAFTS){
    for(const role of ROLES){
      const player=draft.ours.find(item=>item.role===role)!;
      const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank:'IRON'});
      const decisions=decisionText(plan);
      const concepts=expertConcepts(text(plan));
      assert.deepEqual(concepts,[],draft.name+' '+role+' Iron leaked expert concepts: '+concepts.join(', '));
      assert.ok(conditionalCount(decisions)<=3,draft.name+' '+role+' Iron has too many decision branches: '+conditionalCount(decisions));
    }
  }
});

test('the exact same situation becomes materially deeper from Gold to Challenger, not merely longer',()=>{
  for(const draft of DRAFTS){
    for(const role of ROLES){
      const player=draft.ours.find(item=>item.role===role)!;
      const gold=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank:'GOLD'});
      const challenger=buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank:'CHALLENGER'});
      const goldText=text(gold),challengerText=text(challenger);
      const goldExpert=expertConcepts(goldText);
      const challengerExpert=expertConcepts(challengerText);
      assert.ok(goldExpert.length<=1,draft.name+' '+role+' Gold is already carrying elite concepts: '+goldExpert.join(', '));
      assert.ok(challengerExpert.length>=4,draft.name+' '+role+' Challenger lacks genuinely elite decision concepts: '+challengerExpert.join(', '));
      assert.ok(conditionalCount(decisionText(challenger))>=conditionalCount(decisionText(gold))+3,draft.name+' '+role+' Challenger did not add enough decision branches');
      assert.ok(jaccard(goldText,challengerText)<0.97,draft.name+' '+role+' Challenger is too close to Gold; similarity='+jaccard(goldText,challengerText).toFixed(3));
    }
  }
});

test('every adjacent gauntlet rank produces a distinct coaching contract on the same situation',()=>{
  for(const draft of DRAFTS){
    for(const role of ROLES){
      const player=draft.ours.find(item=>item.role===role)!;
      const outputs=RANKS.map(rank=>({
        rank,
        plan:buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank}),
      }));
      for(let index=1;index<outputs.length;index++){
        const previous=outputs[index-1],current=outputs[index];
        assert.notEqual(
          fingerprint(previous.plan),
          fingerprint(current.plan),
          draft.name+' '+role+' '+previous.rank+' and '+current.rank+' collapsed to identical coaching',
        );
        assert.ok(
          jaccard(text(previous.plan),text(current.plan))<0.995,
          draft.name+' '+role+' '+previous.rank+'→'+current.rank+' is cosmetically different only; similarity='+jaccard(text(previous.plan),text(current.plan)).toFixed(3),
        );
      }
    }
  }
});

test('expert complexity arrives progressively rather than appearing at low rank',()=>{
  for(const draft of DRAFTS){
    for(const role of ROLES){
      const player=draft.ours.find(item=>item.role===role)!;
      const plans=new Map<GauntletRank,ReturnType<typeof buildRankAwareDraftPlan>>();
      for(const rank of RANKS)plans.set(rank,buildRankAwareDraftPlan({champion:player.champion,role,ours:[...draft.ours],enemies:[...draft.enemies],rank}));
      const iron=expertConcepts(text(plans.get('IRON')!)).length;
      const silver=expertConcepts(text(plans.get('SILVER')!)).length;
      const gold=expertConcepts(text(plans.get('GOLD')!)).length;
      const emerald=expertConcepts(text(plans.get('EMERALD')!)).length;
      const diamond=expertConcepts(text(plans.get('DIAMOND')!)).length;
      const master=expertConcepts(text(plans.get('MASTER')!)).length;
      const challenger=expertConcepts(text(plans.get('CHALLENGER')!)).length;
      assert.equal(iron,0,draft.name+' '+role+' Iron expert count');
      assert.equal(silver,0,draft.name+' '+role+' Silver expert count');
      assert.ok(gold<=1,draft.name+' '+role+' Gold expert count');
      assert.ok(emerald>=1,draft.name+' '+role+' Emerald should introduce one advanced trade-off');
      assert.ok(diamond>=2,draft.name+' '+role+' Diamond should add a second-layer decision');
      assert.ok(master>=3,draft.name+' '+role+' Master should add resource optimisation');
      assert.ok(challenger>=4,draft.name+' '+role+' Challenger should include elite information-state optimisation');
      assert.ok(iron<=silver&&silver<=gold&&gold<=emerald&&emerald<=diamond&&diamond<=master&&master<=challenger,draft.name+' '+role+' expert complexity regressed across ranks');
    }
  }
});

console.log('BLIND_COACHING_GAUNTLET situations=100 rankOutputs=700 ranks='+RANKS.join(','));
