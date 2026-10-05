import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJourneyState} from '../lib/journeyState';

const base={
  deviceLoaded:true,
  linked:true,
  online:true,
};

test('new player journey is linear from baseline zero through game four',()=>{
  const game0=buildJourneyState({...base,baselineGames:0,dnaRevealed:false});
  assert.equal(game0.phase,'BASELINE');
  assert.equal(game0.progress,'0/3');
  assert.match(game0.cta,/BASELINE GAME 1/);
  assert.match(game0.body,/Permanent Game DNA missions stay locked/i);

  const game1=buildJourneyState({...base,baselineGames:1,dnaRevealed:false});
  assert.equal(game1.phase,'BASELINE');
  assert.equal(game1.progress,'1/3');
  assert.match(game1.cta,/BASELINE GAME 2/);
  assert.match(game1.body,/provisional/i);

  const game2=buildJourneyState({...base,baselineGames:2,dnaRevealed:false});
  assert.equal(game2.phase,'BASELINE');
  assert.equal(game2.progress,'2/3');
  assert.match(game2.cta,/BASELINE GAME 3/);

  const game3BeforeReveal=buildJourneyState({...base,baselineGames:3,dnaRevealed:false,focusName:'Protect the lead'});
  assert.equal(game3BeforeReveal.phase,'DNA_REVEAL');
  assert.equal(game3BeforeReveal.progress,'3/3');
  assert.equal(game3BeforeReveal.cta,'REVEAL MY DNA →');
  assert.match(game3BeforeReveal.title,/ready to reveal/i);

  const revealedNoMission=buildJourneyState({...base,baselineGames:3,dnaRevealed:true});
  assert.equal(revealedNoMission.phase,'DNA_REVEAL');
  assert.equal(revealedNoMission.cta,'REVEAL MY DNA →');

  const firstMission=buildJourneyState({
    ...base,
    baselineGames:3,
    dnaRevealed:true,
    focusName:'Protect the lead',
    focusJob:'When ahead, take the safe objective before chasing.',
    focusConfirmed:0,
    focusRequired:3,
  });
  assert.equal(firstMission.phase,'MISSION');
  assert.equal(firstMission.title,'Protect the lead');
  assert.equal(firstMission.progress,'0/3 proven');
  assert.equal(firstMission.cta,'PLAY NEXT REP →');

  const afterGame4=buildJourneyState({
    ...base,
    baselineGames:4,
    dnaRevealed:true,
    focusName:'Protect the lead',
    focusJob:'When ahead, take the safe objective before chasing.',
    focusConfirmed:1,
    focusRequired:3,
  });
  assert.equal(afterGame4.phase,'MISSION');
  assert.equal(afterGame4.title,'Protect the lead');
  assert.equal(afterGame4.progress,'1/3 proven');
  assert.equal(afterGame4.cta,'PLAY NEXT REP →');
});

test('connection failures always take priority over coaching state',()=>{
  assert.equal(buildJourneyState({deviceLoaded:false,linked:false,online:false,baselineGames:0}).phase,'CHECKING');
  assert.equal(buildJourneyState({deviceLoaded:true,linked:false,online:false,baselineGames:2}).phase,'CONNECT');
  assert.equal(buildJourneyState({deviceLoaded:true,linked:true,online:false,baselineGames:3,dnaRevealed:true,focusName:'Test'}).phase,'RECONNECT');
});
