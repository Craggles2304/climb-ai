import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePlayerRole,
  normalizeTeamAroundPlayer,
  resolveEnemyRoles,
  laneOpponentsFor,
  lanePartnerFor,
} from '../lib/draftRoleResolver';

const practiceOurs=[
  {champion:'Aphelios',role:null},
  {champion:'Rakan',role:'SUPPORT'},
  {champion:'Kassadin',role:'MID'},
  {champion:'Nasus',role:'JUNGLE'},
  {champion:'Ashe',role:'ADC'},
];
const practiceEnemies=[
  {champion:'Sett',role:'TOP'},
  {champion:'Pantheon',role:'JUNGLE'},
  {champion:'Irelia',role:'MID'},
  {champion:'Lucian',role:'ADC'},
  {champion:'Taric',role:'SUPPORT'},
];

test('practice-tool Aphelios uses the player profile/champion prior instead of becoming fake TOP',()=>{
  const resolution=resolvePlayerRole({
    champion:'Aphelios',
    requestRole:null,
    ours:practiceOurs,
    profileRole:'ADC',
    gameMode:'PRACTICETOOL',
  });
  assert.equal(resolution.role,'ADC');
  assert.ok(['PROFILE','CHAMPION_PRIOR'].includes(resolution.source));

  const ours=normalizeTeamAroundPlayer(practiceOurs,'Aphelios',resolution);
  const enemies=resolveEnemyRoles(practiceEnemies);
  assert.equal(ours.find(player=>player.champion==='Aphelios')?.role,'ADC');
  assert.equal(ours.find(player=>player.champion==='Ashe')?.role,'TOP');
  assert.deepEqual(laneOpponentsFor(resolution.role,enemies),['Lucian','Taric']);
  assert.equal(lanePartnerFor(resolution.role,ours,'Aphelios'),'Rakan');
});

test('live support-item evidence overrides an ADC profile for an off-role game',()=>{
  const resolution=resolvePlayerRole({
    champion:'Ashe',
    requestRole:null,
    profileRole:'ADC',
    gameMode:'CLASSIC',
    ours:[
      {champion:'Ashe',role:null,items:[{itemId:3865,displayName:'World Atlas'}]},
      {champion:'Jinx',role:'ADC'},
      {champion:'Nautilus',role:'TOP'},
      {champion:'Ahri',role:'MID'},
      {champion:'Lee Sin',role:'JUNGLE'},
    ],
  });
  assert.equal(resolution.role,'SUPPORT');
  assert.equal(resolution.source,'LIVE');
  assert.equal(resolution.confidence,'HIGH');
});

test('explicit Riot/Companion role beats profile fallback',()=>{
  const resolution=resolvePlayerRole({
    champion:'Aphelios',
    requestRole:'TOP',
    profileRole:'ADC',
    gameMode:'CLASSIC',
    ours:practiceOurs,
  });
  assert.equal(resolution.role,'TOP');
  assert.equal(resolution.source,'REQUEST');
});

test('bot lane is always evaluated as ADC plus support, not the enemy top laner',()=>{
  const enemies=resolveEnemyRoles(practiceEnemies);
  assert.deepEqual(laneOpponentsFor('ADC',enemies),['Lucian','Taric']);
  assert.deepEqual(laneOpponentsFor('SUPPORT',enemies),['Lucian','Taric']);
  assert.deepEqual(laneOpponentsFor('TOP',enemies),['Sett']);
});
