import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summarizeFoundingBeta,type BetaEventRow} from '../lib/foundingBetaModel';

const NOW=Date.parse('2026-09-23T12:00:00.000Z');
const iso=(ms:number)=>new Date(ms).toISOString();
const d=(n:number)=>n*24*60*60*1000;

function row(id:string,event:string,at:number,props:Record<string,unknown>={},user=true):BetaEventRow{
  return{user_id:user?id:null,anon_id:'anon-'+id,event,props,occurred_at:iso(at)};
}

test('Founding Beta model measures the real coaching loop without forcing Companion and Career into one page order',()=>{
  const rows:BetaEventRow[]=[];
  const signup=NOW-d(8);
  for(let i=0;i<12;i++){
    const id='u'+i;
    rows.push(row(id,'signup_completed',signup+i*1000));
    if(i<9)rows.push(row(id,'op_grade_viewed',signup+d(.01)+i*1000));
    if(i<6)rows.push(row(id,'companion_connected',signup+d(.005)+i*1000));
    if(i<4)rows.push(row(id,'companion_game_completed',signup+d(.02)+i*1000));
    if(i<6)rows.push(row(id,'climb_session_started',signup+d(.03)+i*1000));
    if(i<3)rows.push(row(id,'climb_session_completed',signup+d(.2)+i*1000));
    if(i<5)rows.push(row(id,'career_viewed',signup+d(.04)+i*1000));
    if(i<7)rows.push(row(id,'dashboard_view',signup+d(1)+i*1000));
    if(i<2)rows.push(row(id,'dashboard_view',signup+d(7)+i*1000));
  }
  for(let i=0;i<5;i++)rows.push(row('u'+i,'feedback_given',signup+d(.05)+i*1000,{useful:i<4}));

  const report=summarizeFoundingBeta(rows,NOW,45);
  assert.equal(report.activatedPlayers,12);
  assert.equal(report.activationToGradePct,75);
  assert.equal(report.companionAdoptionPct,50);
  assert.equal(report.trackedGameAfterCompanionPct,67);
  assert.equal(report.sessionCompletionPct,50);
  assert.equal(report.careerAdoptionPct,56);
  assert.deepEqual(report.usefulFeedback,{responses:5,useful:4,rate:80});
  assert.equal(report.day1.eligible,12);
  assert.equal(report.day1.returned,7);
  assert.equal(report.day7.returned,2);
  assert.equal(report.gateStatus,'BLOCKED');
});

test('Founding Beta identity stitching joins anonymous pre-auth events to the authenticated founder',()=>{
  const start=NOW-d(2);
  const rows:BetaEventRow[]=[
    row('same','signup_completed',start,{},false),
    row('same','op_grade_viewed',start+5000,{},true),
    row('same','dashboard_view',start+d(1),{},true),
  ];
  const report=summarizeFoundingBeta(rows,NOW,45);
  assert.equal(report.identities,1);
  assert.equal(report.activatedPlayers,1);
  assert.equal(report.activationToGradePct,100);
  assert.equal(report.day1.returned,1);
});

test('session completion never counts unless a valid session start happened first',()=>{
  const start=NOW-d(2);
  const rows:BetaEventRow[]=[
    row('a','signup_completed',start),
    row('a','op_grade_viewed',start+1000),
    row('a','climb_session_completed',start+2000),
  ];
  const report=summarizeFoundingBeta(rows,NOW,45);
  assert.equal(report.milestones.find(x=>x.event==='climb_session_started')?.players,0);
  assert.equal(report.milestones.find(x=>x.event==='climb_session_completed')?.players,0);
  assert.equal(report.sessionCompletionPct,0);
});

test('beta exit gates can reach TARGETS_MET only with enough sample, feedback and eligible retention',()=>{
  const rows:BetaEventRow[]=[];
  const start=NOW-d(8);
  for(let i=0;i<10;i++){
    const id='g'+i,offset=i*1000;
    rows.push(row(id,'signup_completed',start+offset));
    rows.push(row(id,'op_grade_viewed',start+10_000+offset));
    if(i<8){
      rows.push(row(id,'companion_connected',start+20_000+offset));
      rows.push(row(id,'companion_game_completed',start+30_000+offset));
    }
    rows.push(row(id,'climb_session_started',start+40_000+offset));
    if(i<7)rows.push(row(id,'climb_session_completed',start+d(.2)+offset));
    rows.push(row(id,'career_viewed',start+50_000+offset));
    if(i<6)rows.push(row(id,'dashboard_view',start+d(1)+offset));
    if(i<4)rows.push(row(id,'dashboard_view',start+d(7)+offset));
    if(i<6)rows.push(row(id,'feedback_given',start+60_000+offset,{useful:i<5}));
  }
  const report=summarizeFoundingBeta(rows,NOW,45);
  assert.equal(report.gateStatus,'TARGETS_MET');
  assert.ok(report.gates.every(g=>g.met===true));
});

test('Stage 5 milestones are wired into the current product surfaces',()=>{
  const analytics=fs.readFileSync('lib/analytics.ts','utf8');
  const live=fs.readFileSync('components/LiveCommandCenter.tsx','utf8');
  const session=fs.readFileSync('app/session/page.tsx','utf8');
  const progress=fs.readFileSync('app/progress/page.tsx','utf8');
  const admin=fs.readFileSync('app/admin/page.tsx','utf8');
  for(const event of ['companion_connected','companion_recording_started','companion_game_completed','climb_session_started','climb_session_completed','career_viewed']){
    assert.ok(analytics.includes(event),event+' missing from analytics contract');
  }
  assert.ok(live.includes("track('companion_connected'"));
  assert.ok(live.includes("track('companion_game_completed'"));
  assert.ok(session.includes("track('climb_session_started'"));
  assert.ok(session.includes("track('climb_session_completed'"));
  assert.ok(progress.includes('event="career_viewed"'));
  assert.ok(admin.includes('STAGE 5 · FOUNDING BETA VALIDATION'));
  assert.ok(admin.includes('FOUNDING BETA EXIT GATES'));
});
