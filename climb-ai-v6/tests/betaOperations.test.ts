import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildBetaOperationsSnapshot,type BetaOpsEvent,type BetaParticipantProfile} from '../lib/betaOperationsModel';

const NOW=Date.parse('2026-09-23T12:00:00.000Z');
const h=(n:number)=>n*60*60*1000;
const iso=(ms:number)=>new Date(ms).toISOString();

const profile=(id:string,name=id):BetaParticipantProfile=>({
  id,gameName:name,tagline:'EUW',region:'EUW',role:'ADC',rank:'Gold',isFounder:false,createdAt:iso(NOW-h(200)),
});

const row=(id:string,event:string,offsetHours:number,props:Record<string,unknown>={}):BetaOpsEvent=>({
  user_id:id,anon_id:'anon-'+id,event,props,occurred_at:iso(NOW-h(offsetHours)),
});

test('Stage 6 maps each beta player to the first broken point in the coaching loop',()=>{
  const profiles=[profile('a','NoValue'),profile('b','NoCompanion'),profile('c','NoGame'),profile('d','NoSession'),profile('e','SessionOpen'),profile('f','Healthy')];
  const events:BetaOpsEvent[]=[
    row('a','signup_completed',10),

    row('b','signup_completed',10),row('b','op_grade_viewed',9),

    row('c','signup_completed',10),row('c','op_grade_viewed',9),row('c','companion_connected',8),

    row('d','signup_completed',10),row('d','op_grade_viewed',9),row('d','companion_connected',8),row('d','companion_game_completed',7),

    row('e','signup_completed',10),row('e','op_grade_viewed',9),row('e','companion_connected',8),row('e','companion_game_completed',7),row('e','climb_session_started',6),

    row('f','signup_completed',10),row('f','op_grade_viewed',9),row('f','companion_connected',8),row('f','companion_game_completed',7),row('f','climb_session_started',6),row('f','climb_session_completed',5),row('f','career_viewed',4),row('f','dashboard_view',1),
  ];
  const report=buildBetaOperationsSnapshot(events,profiles,NOW);
  const states=Object.fromEntries(report.participants.map(p=>[p.label.split('#')[0],p.state]));
  assert.equal(states.NoValue,'NEEDS_FIRST_VALUE');
  assert.equal(states.NoCompanion,'NEEDS_COMPANION');
  assert.equal(states.NoGame,'NEEDS_TRACKED_GAME');
  assert.equal(states.NoSession,'NEEDS_SESSION');
  assert.equal(states.SessionOpen,'SESSION_IN_PROGRESS');
  assert.equal(states.Healthy,'LOOP_COMPLETE');
});

test('latest rejected coaching feedback overrides a superficially complete funnel',()=>{
  const events=[
    row('x','signup_completed',20),row('x','op_grade_viewed',19),row('x','companion_connected',18),
    row('x','companion_game_completed',17),row('x','climb_session_started',16),row('x','climb_session_completed',15),
    row('x','career_viewed',14),row('x','feedback_given',1,{useful:false}),
  ];
  const report=buildBetaOperationsSnapshot(events,[profile('x','Rejected')],NOW);
  assert.equal(report.participants[0].state,'COACHING_REVIEW');
  assert.equal(report.topBlocker?.surface,'COACHING QUALITY');
  assert.equal(report.recommendedExperiment?.metricKey,'usefulFeedbackPct');
});

test('a new session start after a previous completion is still in progress',()=>{
  const events=[
    row('x','signup_completed',30),row('x','op_grade_viewed',29),row('x','companion_connected',28),
    row('x','companion_game_completed',27),row('x','climb_session_started',26),row('x','climb_session_completed',25),
    row('x','career_viewed',24),row('x','climb_session_started',2),
  ];
  const report=buildBetaOperationsSnapshot(events,[profile('x')],NOW);
  assert.equal(report.participants[0].state,'SESSION_IN_PROGRESS');
  assert.equal(report.participants[0].milestones.sessionCompleted,false);
});

test('completed players become retention risks only after meaningful activity goes quiet for 72 hours',()=>{
  const common=[
    row('x','signup_completed',200),row('x','op_grade_viewed',190),row('x','companion_connected',180),
    row('x','companion_game_completed',170),row('x','climb_session_started',160),row('x','climb_session_completed',150),
    row('x','career_viewed',149),
  ];
  const risk=buildBetaOperationsSnapshot(common,[profile('x')],NOW);
  assert.equal(risk.participants[0].state,'RETENTION_RISK');

  const active=buildBetaOperationsSnapshot([...common,row('x','dashboard_view',1)],[profile('x')],NOW);
  assert.equal(active.participants[0].state,'LOOP_COMPLETE');
});

test('weighted rescue queue chooses the blocker with highest development-operational impact',()=>{
  const profiles=[profile('a'),profile('b'),profile('c')];
  const events=[
    row('a','signup_completed',10),row('a','op_grade_viewed',9),row('a','companion_connected',8),row('a','companion_game_completed',7),row('a','climb_session_started',6),
    row('b','signup_completed',10),row('b','op_grade_viewed',9),row('b','companion_connected',8),row('b','companion_game_completed',7),row('b','climb_session_started',6),
    row('c','signup_completed',10),row('c','op_grade_viewed',9),
  ];
  const report=buildBetaOperationsSnapshot(events,profiles,NOW);
  assert.equal(report.topBlocker?.state,'SESSION_IN_PROGRESS');
  assert.equal(report.topBlocker?.players,2);
  assert.equal(report.recommendedExperiment?.metricKey,'sessionCompletionPct');
});

test('release build coverage separates Stage 6 stamped events from legacy telemetry',()=>{
  const events=[
    row('x','signup_completed',2),
    row('x','op_grade_viewed',1,{buildCommit:'abcdef123456',webVersion:'0.4.0',environment:'production'}),
  ];
  const report=buildBetaOperationsSnapshot(events,[profile('x')],NOW);
  assert.equal(report.buildCoverage.stampedEvents,1);
  assert.equal(report.buildCoverage.unstampedEvents,1);
  assert.equal(report.buildCoverage.latestBuild,'abcdef123456');
});

test('Stage 6 source wiring stamps releases, secures experiments and renders rescue operations',()=>{
  const eventRoute=fs.readFileSync('app/api/events/route.ts','utf8');
  const api=fs.readFileSync('app/api/admin/beta-experiments/route.ts','utf8');
  const admin=fs.readFileSync('app/admin/page.tsx','utf8');
  const migration=fs.readFileSync('supabase/migrations/20260923061900_stage6_beta_experiments.sql','utf8');
  assert.ok(eventRoute.includes('VERCEL_GIT_COMMIT_SHA'));
  assert.ok(eventRoute.includes('RELEASE_MANIFEST.webVersion'));
  assert.ok(eventRoute.includes('props:{...event.props,...release}'));
  assert.ok(api.includes("select('is_founder')"));
  assert.ok(api.includes('START_RECOMMENDED'));
  assert.ok(admin.includes('STAGE 6 · FOUNDING BETA OPERATIONS'));
  assert.ok(admin.includes('PLAYER RESCUE QUEUE'));
  assert.ok(admin.includes('BetaExperimentConsole'));
  assert.ok(migration.includes('beta_experiments_one_running_idx'));
  assert.ok(migration.includes("where status='RUNNING'"));
  assert.ok(migration.includes('revoke all on table public.beta_experiments from anon, authenticated'));
  assert.ok(migration.includes('beta_experiments_no_client_access'));
});
