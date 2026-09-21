const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const esports=fs.readFileSync(path.join(root,'companion','electron','review-esports.js'),'utf8');
const core=fs.readFileSync(path.join(root,'companion','electron','review-v2-core.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));
const reviewRoute=fs.readFileSync(path.join(root,'app','api','live','companion-review','route.ts'),'utf8');
const liveRepo=fs.readFileSync(path.join(root,'lib','server','liveTrackerRepository.ts'),'utf8');
const learningRepo=fs.readFileSync(path.join(root,'lib','server','proLearningRepository.ts'),'utf8');
const learningContext=fs.readFileSync(path.join(root,'components','LearningPlanContext.tsx'),'utf8');
const decisionGraph=fs.readFileSync(path.join(root,'lib','decisionGraph.ts'),'utf8');
const draftCoach=fs.readFileSync(path.join(root,'app','api','live','draft-coach','route.ts'),'utf8');

test('post-game review has a champion-led esports hero instead of a report-only header',()=>{
  for(const label of ['POST MATCH // PERFORMANCE REVIEW','MATCH INTELLIGENCE // VERIFIED REVIEW','GAME DEBRIEF','KDA','CS / MIN','MATCH TIME','DECISIONS']){
    assert.ok(esports.includes(label),`missing ${label}`);
  }
  assert.ok(esports.includes('ddragon.leagueoflegends.com/cdn/img/champion/splash/'));
  assert.ok(esports.includes('op-es-art'));
  assert.ok(esports.includes('op-es-board'));
});

test('post-game review uses recorded evidence as a match-moments timeline',()=>{
  assert.ok(esports.includes('MATCH MOMENTS'));
  assert.ok(esports.includes("item?.verified!==false"));
  assert.ok(esports.includes('item?.atSeconds'));
  assert.ok(esports.includes("item.kind==='fix'?'fix':''"));
  assert.ok(esports.includes('(seconds/duration)*100'));
});

test('next-game coaching call is visually promoted without inventing a performance score',()=>{
  assert.ok(esports.includes('NEXT GAME // ONE CALL'));
  assert.ok(esports.includes('review?.nextFocus?.title'));
  assert.ok(esports.includes('review?.nextFocus?.rule'));
  assert.ok(!esports.includes('PERFORMANCE SCORE'));
  assert.ok(!esports.includes('RATING / 100'));
});

test('completed review has an explicit route back to ready for the next game',()=>{
  assert.ok(core.includes('id="op332Ready"'));
  assert.ok(core.includes('NEW GAME · BACK TO READY'));
  assert.ok(core.includes('localStorage.removeItem(STORAGE_KEY)'));
  assert.ok(core.includes('window.opCompanion?.restart?.()'));
});

test('review layer loads after the evidence renderer and Companion version matches this release',()=>{
  const coreIndex=loader.indexOf("load('review-v2-core.js')");
  const esportsIndex=loader.indexOf("load('review-esports.js')");
  assert.ok(coreIndex>=0&&esportsIndex>coreIndex);
  assert.equal(pkg.version,'0.7.23');
});


test('post-game review prefers the exact deep draft-coach plan and preserves player branch history',()=>{
  assert.ok(core.includes("DEEP_PLAN_STORAGE_KEY='opclimb.deep-locked-plan.v1'"));
  assert.ok(core.includes('function loadDeepLockedPlan'));
  assert.ok(core.includes('function deepBaseline'));
  assert.ok(core.includes('deepPlan:true'));
  assert.ok(core.includes("FIGHT: '+clean(stored.fightTrigger)"));
  assert.ok(core.includes("OBJECTIVE: '+clean(stored.objectiveSetup)"));
  assert.ok(core.includes('DEEP VERIFIED PRE-GAME PLAN'));
  assert.ok(core.includes('PLAYER BRANCHES: '));
  assert.ok(core.includes('NO RESULT-BASED REWRITING'));
  assert.ok(core.includes('localStorage.removeItem(DEEP_PLAN_STORAGE_KEY)'));
});


test('post-game review closes the loop into the server-authoritative Active Five',()=>{
  assert.ok(learningRepo.includes('rebuildProLearningProfileWithIlp'));
  assert.ok(learningRepo.includes('PostGameIlpSyncResult'));
  assert.ok(learningRepo.includes("source:'POST_GAME_EVIDENCE'"));
  assert.ok(learningRepo.includes('active.slice(0,5)'));
  assert.ok(liveRepo.includes('syncLearningPlanForSession'));
  assert.ok(liveRepo.includes('analysisSignature'));
  assert.ok(liveRepo.includes('learningPlanSync'));
  assert.ok(liveRepo.includes("trigger,'FINALIZE'")||liveRepo.includes("'FINALIZE',proAnalysis"));
  assert.ok(reviewRoute.includes('developmentPlan'));
  assert.ok(reviewRoute.includes('ONE_MATCH_CAN_PROGRESS EVIDENCE'));
});

test('Companion shows whether repeated evidence actually changed the development plan',()=>{
  assert.ok(core.includes('DEVELOPMENT PLAN · ACTIVE FIVE'));
  assert.ok(core.includes('ACTIVE FIVE UPDATED FROM REPEATED EVIDENCE'));
  assert.ok(core.includes('ACTIVE FIVE CHECKED · NO MISSION REPLACED'));
  assert.ok(core.includes('One unusual game cannot replace or reopen a persistent development mission.'));
  assert.ok(core.includes('safeArray(plan.activeFive).slice(0,5)'));
  assert.ok(core.includes('renderDevelopmentPlan(review)'));
});

test('open web plan refreshes the server-owned Active Five after returning to the app',()=>{
  assert.ok(learningContext.includes("window.addEventListener('focus',onFocus)"));
  assert.ok(learningContext.includes("document.addEventListener('visibilitychange',pull)"));
  assert.ok(learningContext.includes('refreshCloudNow()'));
});


test('Decision Graph links post-game moments to the exact frozen pre-game coach',()=>{
  assert.ok(decisionGraph.includes('buildDecisionGraph'));
  assert.ok(decisionGraph.includes('planAlignment'));
  assert.ok(decisionGraph.includes('lockedPrinciple'));
  assert.ok(decisionGraph.includes('NOT_VERIFIABLE'));
  assert.ok(draftCoach.includes('persistLockedCoachForPregame'));
  assert.ok(draftCoach.includes('deepCoach'));
  assert.ok(liveRepo.includes('linkedDecisionPlan'));
  assert.ok(liveRepo.includes('decisionGraph:buildDecisionGraph'));
  assert.ok(reviewRoute.includes('decisionGraph:summary?.decisionGraph'));
});

test('Companion post-game debrief renders a chronological Decision Graph without inventing hidden intent',()=>{
  assert.ok(core.includes('DECISION GRAPH · WHAT ACTUALLY HAPPENED'));
  assert.ok(core.includes('function renderDecisionGraph'));
  assert.ok(core.includes('DECISION READ · '));
  assert.ok(core.includes('CONSEQUENCE · '));
  assert.ok(core.includes('LOCKED PLAN · '));
  assert.ok(core.includes('PLAN LINK UNAVAILABLE'));
  assert.ok(core.includes('OP CLIMB will not invent decisions it cannot support from recorded match evidence.'));
  assert.ok(core.includes('renderDecisionGraph(review)'));
});


test('Decision Graph carries immutable draft-situation tags into long-term pattern learning',()=>{
  assert.ok(decisionGraph.includes('situationTags'));
  assert.ok(decisionGraph.includes('contextEnemies'));
  assert.ok(decisionGraph.includes('situationContext'));
  assert.ok(draftCoach.includes('buildDraftSituationContext'));
  assert.ok(draftCoach.includes('situationContext:input.situationContext'));
});


test('post-game review renders the highest-value counterfactual decisions without outcome guarantees',()=>{
  assert.ok(decisionGraph.includes('DecisionCounterfactual'));
  assert.ok(decisionGraph.includes('RECORDED_ALTERNATIVE'));
  assert.ok(decisionGraph.includes('LOCKED_PLAN'));
  assert.ok(decisionGraph.includes('COACHING_RULE'));
  assert.ok(decisionGraph.includes('topCounterfactualNodeIds'));
  assert.ok(decisionGraph.includes('does not claim the alternative would guarantee'));
  assert.ok(core.includes('COUNTERFACTUAL COACHING · BETTER DECISION'));
  assert.ok(core.includes('function renderCounterfactuals'));
  assert.ok(core.includes('WHAT YOU DID'));
  assert.ok(core.includes('BETTER OPTION'));
  assert.ok(core.includes('WHY IT FITS'));
  assert.ok(core.includes('TRADE-OFF'));
  assert.ok(core.includes('EVIDENCE-BOUNDED · NO GUARANTEED OUTCOME'));
  assert.ok(core.includes('renderCounterfactuals(review)'));
});


test('post-game review closes the loop by measuring whether the pre-game Personal Trap transferred',()=>{
  assert.ok(decisionGraph.includes('DecisionCoachingResponse'));
  assert.ok(decisionGraph.includes('coachingResponseFor'));
  assert.ok(decisionGraph.includes('does not claim the cue caused the result'));
  assert.ok(decisionGraph.includes("status:'NO_CUE'|'NO_MATCH'|'EXECUTING'|'MIXED'|'MISSING'"));
  assert.ok(core.includes('COACHING RESPONSE · DID THE CUE TRANSFER?'));
  assert.ok(core.includes('function renderCoachingResponse'));
  assert.ok(core.includes('TRANSFERRED THIS GAME'));
  assert.ok(core.includes('PARTIAL TRANSFER'));
  assert.ok(core.includes('CUE NOT STABLE YET'));
  assert.ok(core.includes('NOT TESTED THIS GAME'));
  assert.ok(core.includes('ASSOCIATION ONLY'));
  assert.ok(core.includes('renderCoachingResponse(review)'));
});


test('post-game review scores the frozen Decision Pre-Mortem without treating unobserved risks as success',()=>{
  assert.ok(decisionGraph.includes('reviewDecisionPremortem'));
  assert.ok(decisionGraph.includes('premortem:premortemReview'));
  assert.ok(core.includes('DECISION PRE-MORTEM · DID THE RISK MAP HOLD?'));
  assert.ok(core.includes('function renderPremortem'));
  assert.ok(core.includes('BEAT PATTERN'));
  assert.ok(core.includes('PATTERN HIT'));
  assert.ok(core.includes('NOT OBSERVED'));
  assert.ok(core.includes('RISK MAP NOT TESTED THIS GAME'));
  assert.ok(core.includes('renderPremortem(review)'));
});


test('post-game review links directly into the player Learning Journey',()=>{
  const main=fs.readFileSync(path.join(root,'companion','electron','main.cjs'),'utf8');
  const preload=fs.readFileSync(path.join(root,'companion','electron','preload.cjs'),'utf8');
  assert.ok(core.includes('VIEW LEARNING JOURNEY'));
  assert.ok(core.includes("openClimbPath?.('/progress')"));
  assert.ok(preload.includes("openClimbPath:(path)=>ipcRenderer.invoke('companion:open-climb-path',path)"));
  assert.ok(main.includes("ipcMain.handle('companion:open-climb-path'"));
  assert.ok(main.includes("new Set(['/live','/progress','/ilp'])"));
});
