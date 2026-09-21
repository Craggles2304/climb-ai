const test=require('node:test');
const assert=require('node:assert/strict');
const {
  reviewPlanRecognition,
  reviewBranchSelection,
  reviewContingencySelection,
}=require('../companion/electron/plan-recognition-review.js');

const point=(atSeconds,verdict,score=0)=>({
  atSeconds,verdict,score,opponent:'Test Enemy',
  comparisonReason:'Visible level/item comparison.',
  reasons:['Recorded visible-state reason.'],
});
const selection=(branch,gameSeconds)=>({branch,gameSeconds,source:'PLAYER_CLICK'});
const contingency=(name,gameSeconds)=>({contingency:name,gameSeconds,source:'PLAYER_CLICK'});
const map={
  contingencies:{
    PLAN_A:{available:true},
    PLAN_B:{available:true},
    RECOVERY:{available:true},
  },
};

test('AHEAD is supported only when nearby visible state actually favours the player',()=>{
  const result=reviewBranchSelection(selection('AHEAD',600),[point(590,'YOU_STRONGER',24)]);
  assert.equal(result.status,'SUPPORTED');
  assert.equal(result.confidence,'HIGH');
  assert.match(result.title,/AHEAD READ SUPPORTED/i);
});

test('AHEAD against an enemy-favoured state is flagged as an overread',()=>{
  const result=reviewBranchSelection(selection('AHEAD',600),[point(610,'THEM_STRONGER',-28)]);
  assert.equal(result.status,'REVIEW');
  assert.match(result.title,/OVERREAD/i);
  assert.match(result.detail,/favoured the opponent/i);
});

test('BEHIND during a stronger visible window is flagged as an underread',()=>{
  const result=reviewBranchSelection(selection('BEHIND',900),[point(920,'YOU_STRONGER',30)]);
  assert.equal(result.status,'REVIEW');
  assert.match(result.title,/UNDERREAD/i);
});

test('RECOVERY is supported by a nearby enemy-favoured state or death',()=>{
  const result=reviewContingencySelection(
    contingency('RECOVERY',1200),
    [point(1185,'THEM_STRONGER',-32)],
    [],
    map,
  );
  assert.equal(result.status,'SUPPORTED');
  assert.match(result.title,/RECOVERY READ SUPPORTED/i);

  const deathSupported=reviewContingencySelection(
    contingency('RECOVERY',1200),
    [point(1185,'EVEN',0)],
    [{atSeconds:1210,outcome:'DEATH',verdict:'EVEN'}],
    map,
  );
  assert.equal(deathSupported.status,'SUPPORTED');
});

test('PLAN B is recorded but not falsely graded from local visible-state evidence',()=>{
  const result=reviewContingencySelection(
    contingency('PLAN_B',1500),
    [point(1490,'THEM_STRONGER',-20)],
    [{atSeconds:1495,outcome:'DEATH'}],
    map,
  );
  assert.equal(result.status,'NOT_VERIFIABLE');
  assert.match(result.detail,/cannot prove/i);
});

test('recognition review ignores old selections that lack game-second evidence',()=>{
  const result=reviewPlanRecognition({
    branchSelections:[{branch:'AHEAD',at:'2026-09-21T12:00:00Z'}],
    contingencySelections:[{contingency:'RECOVERY',at:'2026-09-21T12:01:00Z'}],
    strengthPoints:[point(600,'YOU_STRONGER',25)],
    fightReviews:[],
    contingencyMap:map,
  });
  assert.equal(result.active,false);
  assert.equal(result.graded,0);
});

test('overall review scores only supported versus reviewable reads and keeps no-auto-switch boundary',()=>{
  const result=reviewPlanRecognition({
    branchSelections:[
      selection('AHEAD',600),
      selection('EVEN',900),
      selection('BEHIND',1200),
    ],
    contingencySelections:[
      contingency('RECOVERY',1210),
      contingency('PLAN_B',1500),
    ],
    strengthPoints:[
      point(590,'YOU_STRONGER',22),
      point(905,'EVEN',0),
      point(1190,'THEM_STRONGER',-26),
      point(1490,'EVEN',0),
    ],
    fightReviews:[{atSeconds:1205,outcome:'DEATH',verdict:'THEM_STRONGER'}],
    contingencyMap:map,
  });
  assert.equal(result.active,true);
  assert.equal(result.supported,4);
  assert.equal(result.review,0);
  assert.equal(result.notVerifiable,1);
  assert.equal(result.supportRate,100);
  assert.match(result.boundary,/POST-GAME ONLY/i);
  assert.match(result.boundary,/NEVER AUTO-SELECTS OR CHANGES/i);
});
