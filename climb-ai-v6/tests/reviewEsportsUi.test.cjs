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
  const [major,minor,patch]=pkg.version.split('.').map(Number);assert.ok(major>0||minor>7||(minor===7&&patch>=36));
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
  assert.ok(core.includes('YOUR ACTIVE FIVE'));
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
  assert.ok(core.includes('FULL MATCH TIMELINE'));
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
  assert.ok(core.includes('BETTER DECISION · ALTERNATIVE LINE'));
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
  assert.ok(core.includes('RISK MAP · DID THE PATTERN HOLD?'));
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


test('Decision Simulation closes the pre-game to post-game learning loop',()=>{
  assert.ok(decisionGraph.includes('reviewDecisionSimulation'));
  assert.ok(decisionGraph.includes('simulation:simulationReview'));
  assert.ok(core.includes('MATCH REHEARSAL · REVIEW'));
  assert.ok(core.includes('function renderSimulationReview'));
  assert.ok(core.includes('PATTERN REPEATED'));
  assert.ok(core.includes('PATTERN BROKEN'));
  assert.ok(core.includes('NOT OBSERVED'));
});


test('Scenario Memory closes the spaced-repetition loop without one-game mastery claims',()=>{
  assert.ok(decisionGraph.includes('reviewScenarioPrime'));
  assert.ok(decisionGraph.includes('scenarioPrime:scenarioPrimeReview'));
  assert.ok(core.includes('DECISION LAB · SPACED REP REVIEW'));
  assert.ok(core.includes('function renderScenarioPrimeReview'));
  assert.ok(core.includes('REP EXECUTED'));
  assert.ok(core.includes('OLD BRANCH RETURNED'));
  assert.ok(core.includes('REP NOT TESTED'));
  assert.ok(core.includes('One clean game reinforces the pattern'));
  assert.ok(core.includes('renderScenarioPrimeReview(review)'));
});


test('V5 transfer review only credits frozen novel decisions that actually occurred',()=>{
  assert.ok(decisionGraph.includes('reviewDecisionTransfer'));
  assert.ok(decisionGraph.includes('decisionTransfer:decisionTransferReview'));
  assert.ok(core.includes('CLIMB PROFILE · SKILL TRANSFER'));
  assert.ok(core.includes('function renderDecisionTransferReview'));
  assert.ok(core.includes('PRINCIPLE TRANSFERRED'));
  assert.ok(core.includes('TRANSFER FAILED'));
  assert.ok(core.includes('TRANSFER NOT TESTED'));
  assert.ok(core.includes('renderDecisionTransferReview(review)'));
});


test('post-game review promotes five key decisions and collapses the evidence wall by default',()=>{
  for(const label of ['BIGGEST WIN','BIGGEST REVIEW','NEXT-GAME RULE','KEY DECISIONS · 5 MAX','MATCH DETAILS · PLAN / 3 GOOD / 3 REVIEW / FULL TIMELINE','COACH EVIDENCE · PATTERNS / REHEARSAL / DECISION LAB / SKILL TRANSFER']){
    assert.ok(core.includes(label),`missing compact review label: ${label}`);
  }
  assert.ok(core.includes('function selectKeyDecisions'));
  assert.ok(core.includes('purchaseCount>=1'));
  assert.ok(core.includes('if(chosen.length>=5)break'));
  assert.ok(core.includes('class="op333-details"'));
  assert.ok(!core.includes('DECISION TWIN V3 · SIMULATION REVIEW'));
  assert.ok(!core.includes('DECISION TWIN V4 · SPACED REP REVIEW'));
  assert.ok(!core.includes('DECISION TWIN V5 · TRANSFER REVIEW'));
});


test('post-game review preserves player contingency choices without pretending to validate live state',()=>{
  assert.ok(core.includes('contingencySelections'));
  assert.ok(core.includes('selectedContingency'));
  assert.ok(core.includes('PLAYER CONTINGENCIES:'));
  assert.ok(core.includes('PLAYER-SELECTED · NO RESULT-BASED REWRITING'));
});


test('post-game Game Read reviews player selections without live auto-switching',()=>{
  const recognition=fs.readFileSync(path.join(root,'companion','electron','plan-recognition-review.cjs'),'utf8');
  assert.ok(loader.includes("load('plan-recognition-review.cjs')"));
  assert.ok(loader.indexOf("load('plan-recognition-review.cjs')")<loader.indexOf("load('review-v2-core.js')"));
  assert.ok(core.includes('GAME READ'));
  assert.ok(core.includes('function renderPlanRecognition(review)'));
  assert.ok(core.includes('opPlanRecognitionReview'));
  assert.ok(core.includes('SUPPORTED · ' )||core.includes("' SUPPORTED · '"));
  assert.ok(reviewRoute.includes('recognitionEvidence:{'));
  assert.ok(reviewRoute.includes('strengthPoints:'));
  assert.ok(reviewRoute.includes('fightReviews:'));
  assert.ok(reviewRoute.includes('NEVER USED TO AUTO-SELECT A LIVE PLAN'));
  assert.ok(recognition.includes('POST-GAME ONLY'));
  assert.ok(recognition.includes('NEVER AUTO-SELECTS OR CHANGES'));
  assert.ok(recognition.includes("choice==='PLAN_B'"));
  assert.ok(recognition.includes("status:'NOT_VERIFIABLE'"));
});
