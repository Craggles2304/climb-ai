import test from 'node:test';
import assert from 'node:assert/strict';
import {DNA_DOMAINS,dnaDomainForCategory,dnaDomainForTask} from '../lib/dnaDomain';
import type {IssueCategory} from '../lib/types';

const CATEGORIES:IssueCategory[]=[
  'FARMING','POSITIONING','DEATHS','LANING','TRADING','WAVE_MANAGEMENT',
  'TEMPO','OBJECTIVES','VISION','TEAMFIGHTING','TARGET_SELECTION',
  'RECALL_TIMING','RESOURCE_COLLECTION','MAP_AWARENESS','CHAMPION_MASTERY',
  'ITEMISATION','MATCHUPS','CONSISTENCY',
];

test('every League subskill resolves to one canonical DNA strand',()=>{
  for(const category of CATEGORIES){
    assert.ok(DNA_DOMAINS.includes(dnaDomainForCategory(category)),category);
  }
});

test('context-sensitive subskills resolve to the learning strand they actually train',()=>{
  assert.equal(dnaDomainForTask({category:'DEATHS',metric:'deathsPre10',title:'Reach 10 minutes without a death'}),'LANING');
  assert.equal(dnaDomainForTask({category:'DEATHS',metric:'chain_deaths',title:'Break the second death'}),'CONSISTENCY');
  assert.equal(dnaDomainForTask({category:'DEATHS',metric:'deathsPost20',title:'Survive the first threat cycle'}),'TEAMFIGHTS');
  assert.equal(dnaDomainForTask({category:'RECALL_TIMING',metric:'reset_quality',title:'Improve reset quality'}),'WAVES_CS');
  assert.equal(dnaDomainForTask({category:'MAP_AWARENESS',metric:'killParticipation',title:'Be present for the plays that matter'}),'VISION_MAP');
  assert.equal(dnaDomainForTask({category:'OBJECTIVES',metric:'objectiveParticipation',title:'Arrive set before neutral objectives'}),'OBJECTIVES');
});

test('the public DNA model stays exactly six strands',()=>{
  assert.deepEqual(DNA_DOMAINS,[
    'LANING','WAVES_CS','VISION_MAP','OBJECTIVES','TEAMFIGHTS','CONSISTENCY',
  ]);
});
