import {describe,expect,it} from 'vitest';
import {analyseMatch,missionResult} from '../lib/engine';
import type {Match} from '../lib/types';
import type {ProMatchAnalysis} from '../lib/riot/proAnalysis';

const pro:ProMatchAnalysis={version:1,champion:'Ahri',role:'MIDDLE',evidenceSources:['MATCH_V5','MATCH_V5_TIMELINE'],leakSignals:[],fingerprint:{primary:'RESET',sequence:[],confidence:'HIGH',explanation:'test'},metrics:{
  reset_quality:{key:'reset_quality',label:'RESET QUALITY',score:32,value:'32/100',status:'DERIVED',confidence:'HIGH',sources:['MATCH_V5_TIMELINE'],summary:'Repeated purchase windows were missed before contested plays.',evidence:[{atSeconds:812,label:'Overstay cost',detail:'Death before converting a large bank.'}]},
  objective_readiness:{key:'objective_readiness',label:'OBJECTIVE READINESS',score:76,value:'76/100',status:'DERIVED',confidence:'HIGH',sources:['MATCH_V5_TIMELINE'],summary:'Usually ready for objective windows.',evidence:[]},
}};

const match:Match={id:'match-1',riotAccountId:'acct-1',champion:'Ahri',role:'MID',result:'LOSS',kills:3,deaths:2,assists:5,durationSeconds:1800,rank:'Gold',source:'riot',createdAt:new Date(0).toISOString(),metrics:{cs:180,csPerMin:6,deaths:2,post15CsPerMin:7},proAnalysis:pro};

describe('PRO coaching authority',()=>{
  it('uses PRO evidence instead of the legacy farming/deaths fork',()=>{
    const report=analyseMatch(match,[]);
    expect(report.mission.metric).toBe('reset_quality');
    expect(report.primary.category).toBe('RECALL_TIMING');
    expect(report.primary.facts[0]).toContain('13:32');
  });

  it('grades a PRO mission from the same PRO metric',()=>{
    const report=analyseMatch(match,[]);
    expect(missionResult(report.mission,match).value).toBe(32);
  });
});
