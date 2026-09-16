import {describe,expect,it} from 'vitest';
import {leakMetricBoosts} from '../lib/proLeakWeighting';
import {pickProCoachingCandidate} from '../lib/proCoachingDecision';
import type {ProMatchAnalysis,ProMetric} from '../lib/riot/proAnalysis';

function metric(key:string,score:number):ProMetric{return {key:key as ProMetric['key'],label:key,score,value:`${score}/100`,status:'DERIVED',confidence:'HIGH',sources:['LIVE_TELEMETRY'],summary:key,evidence:[]}}

describe('PRO leak signal weighting',()=>{
  it('maps detector leak keys onto the coaching metrics they actually describe',()=>{
    const boosts=leakMetricBoosts([{key:'BANKING_LEAK',label:'Fighting before spending',count:3,severity:'MAJOR',detail:'',evidenceSeconds:[]}]);
    expect(boosts.get('unspent_gold')).toBeGreaterThan(boosts.get('resource_conversion')??0);
    expect(boosts.get('resource_conversion')).toBeGreaterThan(boosts.get('reset_quality')??0);
    expect(boosts.get('BANKING_LEAK')).toBeUndefined();
  });

  it('lets repeated red-state evidence select fight selection over a slightly weaker unrelated metric',()=>{
    const analysis:ProMatchAnalysis={version:1,champion:'Hecarim',role:'JUNGLE',evidenceSources:['LIVE_TELEMETRY'],metrics:{
      fight_selection:metric('fight_selection',45),
      objective_readiness:metric('objective_readiness',35),
    },leakSignals:[{key:'RED_STATE',label:'Bad fight selection',count:4,severity:'CRITICAL',detail:'',evidenceSeconds:[600,800,1000,1200]}],fingerprint:{primary:'BAD FIGHT SELECTION',sequence:[],confidence:'HIGH',explanation:''}};
    expect(pickProCoachingCandidate(analysis)?.key).toBe('fight_selection');
  });
});
