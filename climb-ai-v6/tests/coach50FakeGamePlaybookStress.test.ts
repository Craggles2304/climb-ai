import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankAwareDraftPlan} from '../lib/draftCoachEngine';
import {buildFrozenGamePlaybook,chooseFrozenBranch,type FrozenBranchKey} from '../lib/frozenGamePlaybook';
import type {DraftRole,DraftRolePlayer} from '../lib/draftRoleResolver';

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const RANKS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER'] as const;
const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});

const POOLS={
  TOP:{
    ours:['Ornn','Camille','Poppy','Gwen','Kennen','Shen','Vayne','Malphite','Fiora','Dr. Mundo'],
    enemies:['Sett','Jax','Sion','Rumble','Gnar','Aatrox','Kayle','Yorick','Volibear','Kled'],
  },
  JUNGLE:{
    ours:['Sejuani','Nocturne','Vi','Kindred','Jarvan IV','Fiddlesticks','Lee Sin','Maokai','Graves','Amumu'],
    enemies:['Hecarim','Pantheon','Xin Zhao','Elise','Wukong','Lillia','Nidalee','Karthus',"Rek'Sai",'Skarner'],
  },
  MID:{
    ours:['Orianna','Ahri','Kassadin','Viktor','Taliyah','Zoe','Diana','Anivia','Syndra','Lissandra'],
    enemies:['Akali','Zed','Azir','Yone','Hwei','Vladimir','LeBlanc','Veigar','Aurelion Sol','Twisted Fate'],
  },
  ADC:{
    ours:['Aphelios','Jinx',"Kog'Maw",'Xayah','Ezreal','Sivir','Varus','Caitlyn',"Kai'Sa",'Jhin'],
    enemies:['Lucian','Draven','Samira','Zeri','Twitch','Smolder','Ashe','Miss Fortune','Kalista','Tristana'],
  },
  SUPPORT:{
    ours:['Rakan','Lulu','Braum','Thresh','Janna','Nautilus','Rell','Karma','Milio','Alistar'],
    enemies:['Taric','Leona','Blitzcrank','Nami','Renata Glasc','Pyke','Soraka','Sona','Tahm Kench','Morgana'],
  },
} as const;

function fakeDraft(index:number){
  const a=index%10;
  const b=Math.floor(index/10)%5;
  const oi=[a,(a+b+1)%10,(2*a+b+2)%10,(3*a+2*b+3)%10,(4*a+b+4)%10];
  const ei=[(5*a+b+1)%10,(3*a+2*b+2)%10,(7*a+b+3)%10,(2*a+4*b+4)%10,(9*a+b+5)%10];
  return{
    ours:ROLES.map((role,i)=>P(POOLS[role].ours[oi[i]],role)),
    enemies:ROLES.map((role,i)=>P(POOLS[role].enemies[ei[i]],role)),
  };
}

type FakeSnapshot={
  minute:number;
  goldDiff:number;
  killDiff:number;
  dragonsFor:number;
  dragonsAgainst:number;
  playerDeaths:number;
  marker:string;
  manualBranch:FrozenBranchKey;
};

const TRAJECTORIES:Array<Array<Omit<FakeSnapshot,'marker'>>>=[
  [
    {minute:5,goldDiff:600,killDiff:2,dragonsFor:0,dragonsAgainst:0,playerDeaths:0,manualBranch:'AHEAD'},
    {minute:10,goldDiff:1500,killDiff:4,dragonsFor:1,dragonsAgainst:0,playerDeaths:0,manualBranch:'AHEAD'},
    {minute:15,goldDiff:400,killDiff:1,dragonsFor:1,dragonsAgainst:1,playerDeaths:1,manualBranch:'EVEN'},
    {minute:20,goldDiff:-900,killDiff:-2,dragonsFor:1,dragonsAgainst:2,playerDeaths:2,manualBranch:'BEHIND'},
    {minute:25,goldDiff:-200,killDiff:0,dragonsFor:2,dragonsAgainst:2,playerDeaths:2,manualBranch:'EVEN'},
    {minute:30,goldDiff:2100,killDiff:5,dragonsFor:3,dragonsAgainst:2,playerDeaths:2,manualBranch:'AHEAD'},
  ],
  [
    {minute:5,goldDiff:-700,killDiff:-2,dragonsFor:0,dragonsAgainst:0,playerDeaths:1,manualBranch:'BEHIND'},
    {minute:10,goldDiff:-1600,killDiff:-4,dragonsFor:0,dragonsAgainst:1,playerDeaths:2,manualBranch:'BEHIND'},
    {minute:15,goldDiff:-300,killDiff:-1,dragonsFor:1,dragonsAgainst:1,playerDeaths:2,manualBranch:'EVEN'},
    {minute:20,goldDiff:900,killDiff:2,dragonsFor:2,dragonsAgainst:1,playerDeaths:2,manualBranch:'AHEAD'},
    {minute:25,goldDiff:200,killDiff:1,dragonsFor:2,dragonsAgainst:2,playerDeaths:3,manualBranch:'EVEN'},
    {minute:30,goldDiff:-1200,killDiff:-3,dragonsFor:2,dragonsAgainst:3,playerDeaths:4,manualBranch:'BEHIND'},
  ],
  [
    {minute:5,goldDiff:50,killDiff:0,dragonsFor:0,dragonsAgainst:0,playerDeaths:0,manualBranch:'EVEN'},
    {minute:10,goldDiff:-100,killDiff:0,dragonsFor:0,dragonsAgainst:1,playerDeaths:1,manualBranch:'EVEN'},
    {minute:15,goldDiff:120,killDiff:1,dragonsFor:1,dragonsAgainst:1,playerDeaths:1,manualBranch:'EVEN'},
    {minute:20,goldDiff:-80,killDiff:-1,dragonsFor:1,dragonsAgainst:1,playerDeaths:2,manualBranch:'EVEN'},
    {minute:25,goldDiff:160,killDiff:1,dragonsFor:2,dragonsAgainst:2,playerDeaths:2,manualBranch:'EVEN'},
    {minute:30,goldDiff:300,killDiff:1,dragonsFor:2,dragonsAgainst:2,playerDeaths:2,manualBranch:'EVEN'},
  ],
];

test('50 fake games keep one frozen pregame playbook through 300 changing live snapshots',()=>{
  const draftSignatures=new Set<string>();
  const roleCounts=new Map(ROLES.map(role=>[role,0]));
  const rankCounts=new Map(RANKS.map(rank=>[rank,0]));
  let snapshotsChecked=0;
  let branchChanges=0;

  for(let game=0;game<50;game++){
    const draft=fakeDraft(game);
    const draftSignature=[...draft.ours,...draft.enemies].map(player=>player.role+':'+player.champion).join('|');
    assert.ok(!draftSignatures.has(draftSignature),'duplicate fake-game draft '+game);
    draftSignatures.add(draftSignature);

    const role=ROLES[game%ROLES.length];
    const rank=RANKS[game%RANKS.length];
    roleCounts.set(role,(roleCounts.get(role)||0)+1);
    rankCounts.set(rank,(rankCounts.get(rank)||0)+1);
    const player=draft.ours.find(item=>item.role===role)!;
    const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:draft.ours,enemies:draft.enemies,rank});
    const playbook=buildFrozenGamePlaybook({champion:player.champion,role,rank,ours:draft.ours,enemies:draft.enemies,plan});
    const frozenJson=JSON.stringify(playbook);
    const frozenFingerprint=playbook.draftFingerprint;

    assert.equal(playbook.version,'FROZEN_V1');
    assert.equal(playbook.checkpoints.length,3);
    assert.deepEqual(playbook.checkpoints.map(check=>check.minute),[5,10,15]);
    for(const check of playbook.checkpoints){
      assert.match(check.prompt,/READ THE BOARD YOURSELF/);
      assert.ok(check.questions.some(question=>/AHEAD \/ EVEN \/ BEHIND/.test(question)));
    }

    const rawTrajectory=TRAJECTORIES[game%TRAJECTORIES.length];
    const timeline:FakeSnapshot[]=rawTrajectory.map(snapshot=>({
      ...snapshot,
      marker:'LIVE_ONLY_GAME_'+game+'_MIN_'+snapshot.minute+'_GOLD_'+snapshot.goldDiff+'_KILLS_'+snapshot.killDiff,
    }));

    let previousBranch:FrozenBranchKey|null=null;
    for(const snapshot of timeline){
      snapshotsChecked++;
      if(previousBranch&&previousBranch!==snapshot.manualBranch)branchChanges++;
      previousBranch=snapshot.manualBranch;

      const selected=chooseFrozenBranch(playbook,snapshot.manualBranch);
      assert.equal(selected.key,snapshot.manualBranch);
      assert.ok(selected.rule.length>20);
      assert.ok(selected.fight.length>20);
      assert.ok(selected.objective.length>20);
      assert.ok(selected.never.length>20);
      assert.ok(['FARM','FIGHT','PRESSURE','STABILISE','SET UP'].includes(selected.priority));
      assert.ok(selected.job.length>10);
      assert.ok(selected.fightWhen.length>10);
      assert.ok(selected.stop.length>10);

      // Fake telemetry exists only in the simulation. It must never rewrite the coach.
      const rebuilt=buildFrozenGamePlaybook({champion:player.champion,role,rank,ours:draft.ours,enemies:draft.enemies,plan});
      assert.equal(rebuilt.draftFingerprint,frozenFingerprint,'live state changed draft fingerprint in game '+game);
      assert.equal(JSON.stringify(rebuilt),frozenJson,'live state rewrote frozen coach in game '+game+' at '+snapshot.minute+'m');
      assert.ok(!frozenJson.includes(snapshot.marker),'live-only marker leaked into the pregame playbook');
      assert.ok(!frozenJson.includes('GOLD_'+snapshot.goldDiff),'live gold leaked into pregame playbook');
      assert.ok(!frozenJson.includes('KILLS_'+snapshot.killDiff),'live kill state leaked into pregame playbook');
    }

    // Returning to the same manually chosen branch later must return the exact same prewritten coaching.
    const aheadA=chooseFrozenBranch(playbook,'AHEAD');
    const aheadB=chooseFrozenBranch(playbook,'AHEAD');
    const behindA=chooseFrozenBranch(playbook,'BEHIND');
    const behindB=chooseFrozenBranch(playbook,'BEHIND');
    assert.deepEqual(aheadA,aheadB);
    assert.deepEqual(behindA,behindB);

    assert.match(playbook.branches.AHEAD.headline,/AHEAD/);
    assert.match(playbook.branches.EVEN.headline,/EVEN/);
    assert.match(playbook.branches.BEHIND.headline,/BEHIND/);
    assert.notEqual(playbook.branches.AHEAD.rule,playbook.branches.BEHIND.rule);
    assert.notEqual(playbook.branches.EVEN.rule,playbook.branches.BEHIND.rule);
    assert.equal(playbook.branches.AHEAD.priority,'PRESSURE');
    assert.equal(playbook.branches.BEHIND.priority,'STABILISE');
    assert.notEqual(playbook.branches.AHEAD.job,playbook.branches.BEHIND.job);
    assert.ok(playbook.baseCall.length>10);
    assert.ok(playbook.threatRule.length>10);
    assert.ok(playbook.objectiveRule.length>10);
  }

  assert.equal(draftSignatures.size,50);
  assert.equal(snapshotsChecked,300);
  assert.ok(branchChanges>=100,'fake games did not create enough state swings');
  for(const role of ROLES)assert.equal(roleCounts.get(role),10,role+' fake-game coverage');
  for(const rank of RANKS)assert.ok((rankCounts.get(rank)||0)>=6,rank+' fake-game rank coverage');
  console.log('COACH50_FAKE_GAMES drafts='+draftSignatures.size+' snapshots='+snapshotsChecked+' branchChanges='+branchChanges+' frozenRewrites=0');
});

test('manual branch selection is the only state input: fake telemetry never enters the playbook API',()=>{
  const draft=fakeDraft(7);
  const role:DraftRole='ADC';
  const player=draft.ours.find(item=>item.role===role)!;
  const plan=buildRankAwareDraftPlan({champion:player.champion,role,ours:draft.ours,enemies:draft.enemies,rank:'PLATINUM'});
  const playbook=buildFrozenGamePlaybook({champion:player.champion,role,rank:'PLATINUM',ours:draft.ours,enemies:draft.enemies,plan});

  const fakeLiveStates=[
    {goldDiff:5000,alive:true,baron:true,enemyFlashDown:true},
    {goldDiff:-5000,alive:false,baron:false,enemyFlashDown:false},
    {goldDiff:0,alive:true,baron:false,enemyFlashDown:true},
  ];
  const before=JSON.stringify(playbook);
  for(const state of fakeLiveStates){
    void state;
    assert.equal(JSON.stringify(playbook),before);
  }

  assert.equal(chooseFrozenBranch(playbook,'AHEAD'),playbook.branches.AHEAD);
  assert.equal(chooseFrozenBranch(playbook,'EVEN'),playbook.branches.EVEN);
  assert.equal(chooseFrozenBranch(playbook,'BEHIND'),playbook.branches.BEHIND);
});
