import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDraftCarryMap,carryScore} from '../lib/carryRoleMap';
import type {DraftRole,DraftRolePlayer} from '../lib/draftRoleResolver';

const P=(champion:string,role:DraftRole):DraftRolePlayer=>({champion,role});

test('protect composition correctly makes Jinx the primary resource condition',()=>{
  const ours=[
    P('Ornn','TOP'),
    P('Sejuani','JUNGLE'),
    P('Orianna','MID'),
    P('Jinx','ADC'),
    P('Lulu','SUPPORT'),
  ];
  const enemies=[
    P('Jax','TOP'),
    P('Vi','JUNGLE'),
    P('Akali','MID'),
    P('Varus','ADC'),
    P('Nautilus','SUPPORT'),
  ];
  const map=buildDraftCarryMap({champion:'Ornn',ours,enemies,mainThreat:'Akali'});
  assert.equal(map.primary.champion,'Jinx');
  assert.equal(map.secondary?.champion,'Orianna');
  assert.equal(map.playerRole,'THREAT_DENIAL');
  assert.equal(map.playerLabel,'THREAT DENIAL');
  assert.equal(map.resourceOwner,'Jinx');
  assert.match(map.playAround,/Jinx/);
  assert.match(map.playAround,/Akali/);
  assert.match(map.playerJob,/KEEP Jinx PLAYABLE/i);
  assert.equal(map.frozenFromPregame,true);
  assert.equal(map.usesLiveTelemetry,false);
});

test('carry map does not automatically promote the ADC',()=>{
  const ours=[
    P('Malphite','TOP'),
    P('Kindred','JUNGLE'),
    P('Galio','MID'),
    P('Ashe','ADC'),
    P('Leona','SUPPORT'),
  ];
  const enemies=[
    P('Sion','TOP'),
    P('Lee Sin','JUNGLE'),
    P('Syndra','MID'),
    P('Jhin','ADC'),
    P('Braum','SUPPORT'),
  ];
  const map=buildDraftCarryMap({champion:'Kindred',ours,enemies,mainThreat:'Syndra'});
  assert.equal(map.primary.champion,'Kindred');
  assert.equal(map.playerRole,'PRIMARY_CARRY');
  assert.equal(map.playerLabel,'PRIMARY CARRY');
  assert.ok(carryScore(P('Kindred','JUNGLE'))>carryScore(P('Ashe','ADC')));
});

test('scaling side-lane carry can outrank a conventional marksman',()=>{
  const ours=[
    P('Kayle','TOP'),
    P('Maokai','JUNGLE'),
    P('Lissandra','MID'),
    P('Jhin','ADC'),
    P('Braum','SUPPORT'),
  ];
  const enemies=[
    P('Renekton','TOP'),
    P('Jarvan IV','JUNGLE'),
    P('Ahri','MID'),
    P('Ezreal','ADC'),
    P('Nami','SUPPORT'),
  ];
  const map=buildDraftCarryMap({champion:'Kayle',ours,enemies,mainThreat:'Jarvan IV'});
  assert.equal(map.primary.champion,'Kayle');
  assert.equal(map.playerRole,'PRIMARY_CARRY');
  assert.match(map.playerJob,/SAFE HIGH-VALUE RESOURCES/i);
});

test('a second damage source is labelled secondary carry instead of generic enabler',()=>{
  const ours=[
    P('Ornn','TOP'),
    P('Sejuani','JUNGLE'),
    P('Orianna','MID'),
    P('Jinx','ADC'),
    P('Lulu','SUPPORT'),
  ];
  const enemies=[
    P('Camille','TOP'),
    P('Vi','JUNGLE'),
    P('Akali','MID'),
    P('Varus','ADC'),
    P('Nautilus','SUPPORT'),
  ];
  const map=buildDraftCarryMap({champion:'Orianna',ours,enemies,mainThreat:'Vi'});
  assert.equal(map.primary.champion,'Jinx');
  assert.equal(map.playerRole,'SECONDARY_CARRY');
  assert.equal(map.playerLabel,'SECONDARY CARRY');
  assert.match(map.playerJob,/CONNECT TO Jinx/i);
});

test('support is not mislabelled as the carry when the draft has a real damage condition',()=>{
  const ours=[
    P('Camille','TOP'),
    P('Graves','JUNGLE'),
    P('Ahri','MID'),
    P('Aphelios','ADC'),
    P('Thresh','SUPPORT'),
  ];
  const enemies=[
    P('Jax','TOP'),
    P('Nocturne','JUNGLE'),
    P('Viktor','MID'),
    P('Caitlyn','ADC'),
    P('Milio','SUPPORT'),
  ];
  const map=buildDraftCarryMap({champion:'Thresh',ours,enemies,mainThreat:'Nocturne'});
  assert.equal(map.primary.champion,'Aphelios');
  assert.equal(map.playerRole,'THREAT_DENIAL');
  assert.match(map.playerJob,/Aphelios/);
  assert.match(map.playerJob,/Nocturne/);
});
