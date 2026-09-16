import {describe,expect,it} from 'vitest';
import {adaptAndRefill,adaptILP} from '@/lib/ilpEngine';
import type {ILPTask,Match} from '@/lib/types';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

function pro(score:number):ProMatchAnalysis{return{version:1,champion:'Hecarim',role:'JUNGLE',evidenceSources:['riot-timeline'],leakSignals:[],fingerprint:{primary:'reset_quality',sequence:['reset_quality'],confidence:'HIGH',explanation:'Reset quality is the repeated limiter.'},metrics:{reset_quality:{key:'reset_quality',label:'Reset quality',score,value:`${score}/100`,status:'MEASURED',confidence:'HIGH',sources:['riot-timeline'],summary:'Too much unspent gold was carried into important fights.',evidence:[{atSeconds:812,label:'Fight',detail:'Entered the fight before spending a completed purchase.'}]}}}}
function match(id:string,score:number):Match{return{id,riotAccountId:'acct',champion:'Hecarim',role:'JUNGLE',result:'WIN',kills:5,deaths:3,assists:8,durationSeconds:1800,rank:'Gold',source:'riot',createdAt:new Date().toISOString(),metrics:{cs:180,csPerMin:6,deaths:3},proAnalysis:pro(score)}}
function task():ILPTask{return{id:'pro-reset',accountId:'acct',title:'Improve Reset quality',category:'RECALL_TIMING',why:'Spend before the fight.',gameRule:'Spend before contesting.',metric:'reset_quality',target:'85+ PRO evidence score across 3 games',progress:40,status:'ACTIVE',source:'SYSTEM',evidence:[],masteryRequired:3}}

describe('PRO ILP authority',()=>{
 it('uses PRO metric scores as automatic ILP evidence',()=>{const result=adaptILP([task()],[match('a',70),match('b',80)]).tasks[0];expect(result.metricProgress).toBe(75);expect(result.gamesObserved).toBe(2);expect(result.successfulGames).toBe(0)});
 it('masters a PRO mission after three evidence-backed games clear the target',()=>{const result=adaptILP([task()],[match('a',90),match('b',88),match('c',92)]).tasks[0];expect(result.status).toBe('MASTERED');expect(result.successfulGames).toBe(3)});
 it('refills the active five from the next weakest PRO evidence before generic baselines',()=>{const seed=[task()];const result=adaptAndRefill(seed,[match('a',55)],'acct','JUNGLE').tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED');expect(result).toHaveLength(5);expect(result.some(t=>t.metric==='reset_quality')).toBe(true)});
});