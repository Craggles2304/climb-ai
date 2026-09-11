import type {AbilitySlot} from './combos';
import {legalDefaultRanks,normaliseStandardRanks,type AbilityRanks} from './skillRanks';

export type LaneSkillRole='BOTTOM'|'SUPPORT';
export type SkillPathSource='OBSERVED_EXACT_PATCH'|'OBSERVED_ADJACENT_PATCH'|'STANDARD_FALLBACK'|'MANUAL';

export interface SkillProgressionResult{
  ranks:Record<AbilitySlot,number>;
  source:SkillPathSource;
  sourceName:string;
  observedPatch:string|null;
  order:AbilitySlot[]|null;
  note:string;
}

interface ObservedPath{
  champion:string;
  role:LaneSkillRole;
  observedPatch:string;
  /** One skill point per level. Only the early levels needed by the lane map are required. */
  order:AbilitySlot[];
  sourceName:string;
}

/**
 * Observed bot-lane skill paths used only as a level-map baseline when the user
 * has not supplied ranks. These are gameplay observations, not Riot rules.
 *
 * The numerical combat engine remains deterministic either way: this layer only
 * chooses which legal ability ranks exist at levels 1-6. Exact user-entered
 * ranks always win. Paths are patch-labelled and fail back visibly when stale.
 */
const OBSERVED:ObservedPath[]=[
  {
    champion:'kogmaw',role:'BOTTOM',observedPatch:'16.18',
    order:['W','E','Q','W','W','R'],sourceName:'LoLalytics bottom observed skill order',
  },
  {
    champion:'caitlyn',role:'BOTTOM',observedPatch:'16.17',
    order:['Q','W','E','Q','Q','R'],sourceName:'LoLalytics bottom observed skill order',
  },
  {
    champion:'lulu',role:'SUPPORT',observedPatch:'16.17',
    order:['Q','E','W','E','E','R'],sourceName:'LoLalytics support observed skill order',
  },
  {
    champion:'lux',role:'SUPPORT',observedPatch:'16.18',
    order:['E','Q','E','W','E','R'],sourceName:'LoLalytics support observed skill order',
  },
  {
    champion:'jinx',role:'BOTTOM',observedPatch:'16.18',
    order:['Q','E','W','Q','Q','R'],sourceName:'LoLalytics bottom observed skill order',
  },
  {
    champion:'ezreal',role:'BOTTOM',observedPatch:'16.18',
    order:['Q','E','W','Q','Q','R'],sourceName:'LoLalytics bottom observed skill order',
  },
  {
    champion:'ashe',role:'BOTTOM',observedPatch:'16.18',
    order:['W','Q','E','W','W','R'],sourceName:'LoLalytics bottom observed skill order',
  },
  {
    champion:'nami',role:'SUPPORT',observedPatch:'16.18',
    order:['W','E','Q','W','W','R'],sourceName:'LoLalytics support observed skill order',
  },
  {
    champion:'nautilus',role:'SUPPORT',observedPatch:'16.18',
    order:['Q','W','E','E','E','R'],sourceName:'LoLalytics support observed skill order',
  },
];

export function resolveEarlySkillProgression(opts:{
  championId:string;
  role:LaneSkillRole;
  patch:string;
  level:number;
  requested?:AbilityRanks;
}):SkillProgressionResult{
  const manual=hasExplicitRank(opts.requested);
  if(manual){
    return {
      ranks:normaliseStandardRanks(opts.requested,opts.level),source:'MANUAL',sourceName:'Player-entered ranks',
      observedPatch:null,order:null,note:'Exact player-entered ability ranks are being used; no observed skill path was inferred.',
    };
  }

  const champion=normalise(opts.championId);
  const path=OBSERVED.find(entry=>entry.champion===champion&&entry.role===opts.role);
  if(!path){
    return fallback(opts.level,`No validated ${opts.role.toLowerCase()} early skill path is registered for ${opts.championId}; CLIMB is using its legal standard fallback and labels it as a fallback.`);
  }

  const distance=patchDistance(path.observedPatch,opts.patch);
  if(distance===null||distance>1){
    return fallback(opts.level,`${path.sourceName} was observed on ${path.observedPatch}, which is not close enough to ${opts.patch} to auto-carry. Legal standard fallback used instead.`);
  }

  const ranks=ranksFromOrder(path.order,opts.level);
  const exact=distance===0;
  return {
    ranks,
    source:exact?'OBSERVED_EXACT_PATCH':'OBSERVED_ADJACENT_PATCH',
    sourceName:path.sourceName,
    observedPatch:path.observedPatch,
    order:[...path.order],
    note:exact
      ?`${path.sourceName} · patch ${path.observedPatch} · levels 1-${Math.min(6,Math.max(1,Math.round(opts.level)))} use ${path.order.slice(0,Math.min(6,Math.max(1,Math.round(opts.level)))).join(' → ')}.`
      :`${path.sourceName} was observed on adjacent patch ${path.observedPatch}; current data patch is ${opts.patch}. The level-map uses it as an observed baseline, not a Riot rule.`,
  };
}

export function observedSkillPath(championId:string,role:LaneSkillRole):ObservedPath|null{
  const found=OBSERVED.find(entry=>entry.champion===normalise(championId)&&entry.role===role);
  return found?{...found,order:[...found.order]}:null;
}

function ranksFromOrder(order:AbilitySlot[],level:number):Record<AbilitySlot,number>{
  const ranks:Record<AbilitySlot,number>={Q:0,W:0,E:0,R:0};
  const points=Math.max(1,Math.min(18,Math.round(level)));
  const fallbackOrder=order.length>=points?order:expandWithLegalFallback(order,points);
  for(const slot of fallbackOrder.slice(0,points))ranks[slot]++;
  return normaliseStandardRanks(ranks,points);
}

function expandWithLegalFallback(order:AbilitySlot[],points:number):AbilitySlot[]{
  const out=[...order];
  const fallback=legalSequence(points);
  for(let i=out.length;i<points;i++)out.push(fallback[i]??'Q');
  return out;
}

function legalSequence(level:number):AbilitySlot[]{
  const sequence:AbilitySlot[]=[];
  let previous:Record<AbilitySlot,number>={Q:0,W:0,E:0,R:0};
  for(let current=1;current<=level;current++){
    const next=legalDefaultRanks(current);
    const gained=(['Q','W','E','R'] as AbilitySlot[]).find(slot=>next[slot]>previous[slot])??'Q';
    sequence.push(gained);previous=next;
  }
  return sequence;
}

function fallback(level:number,note:string):SkillProgressionResult{
  return {ranks:legalDefaultRanks(level),source:'STANDARD_FALLBACK',sourceName:'CLIMB legal standard fallback',observedPatch:null,order:null,note};
}
function hasExplicitRank(requested:AbilityRanks|undefined){return Boolean(requested&&Object.keys(requested).length>0)}
function patchDistance(a:string,b:string):number|null{
  const x=patchParts(a),y=patchParts(b);if(!x||!y||x.major!==y.major)return null;return Math.abs(x.minor-y.minor);
}
function patchParts(value:string){const match=/^(\d+)\.(\d+)/.exec(String(value).trim());return match?{major:Number(match[1]),minor:Number(match[2])}:null}
const normalise=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
