import {describe,it,expect} from 'vitest';
import {adaptILP,ensureFiveActive} from '@/lib/ilpEngine';
import type {ILPTask,Match} from '@/lib/types';

const metric=(score:number)=>({key:'reset_quality',label:'Reset Quality',score,value:score,status:'MEASURED' as const,confidence:'HIGH' as const,sources:['MATCH_V5' as const],summary:'Resets repeatedly lose spend windows.',evidence:[]});
const game=(id:string,score:number):Match=>({id,riotAccountId:'a',champion:'Ahri',role:'MID',result:'LOSS',kills:1,deaths:4,assists:3,durationSeconds:1800,rank:'Gold',metrics:{cs:180,csPerMin:6,deaths:4},source:'riot',createdAt:'2026-09-16T10:00:00Z',proAnalysis:{matchId:id,accountId:'a',generatedAt:'2026-09-16T10:00:00Z',metrics:{reset_quality:metric(score)} as any,leakSignals:[],fingerprint:{primary:'reset_quality',sequence:[],confidence:'HIGH',explanation:'test'}} as any});
const task=(target='65+ PRO evidence score across 3 games'):ILPTask=>({id:'t',accountId:'a',title:'Improve Reset Quality',category:'RECALL_TIMING',why:'test',gameRule:'spend before fights',metric:'reset_quality',target,progress:60,status:'ACTIVE',source:'SYSTEM',evidence:[],priority:95,masteryRequired:3});

describe('adaptive PRO ILP',()=>{
 it('masters against the personalised PRO target rather than a hidden 85',()=>{const result=adaptILP([task()],[game('1',70),game('2',68),game('3',66)]);expect(result.tasks[0].status).toBe('MASTERED');expect(result.tasks[0].metricProgress).toBe(68)});
 it('does not promote a one-game PRO outlier into the active five',()=>{const result=ensureFiveActive([], [game('1',25),game('2',85),game('3',88)],'a','MID');expect(result.tasks.some(t=>t.metric==='reset_quality')).toBe(false)});
 it('promotes a recurring PRO weakness seen in at least two recent games',()=>{const result=ensureFiveActive([], [game('1',42),game('2',48),game('3',82)],'a','MID');const promoted=result.tasks.find(t=>t.metric==='reset_quality');expect(promoted).toBeTruthy();expect(promoted?.evidence.join(' ')).toContain('2/3')});
});
