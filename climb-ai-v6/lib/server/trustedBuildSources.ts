import 'server-only';
import {buildTrustedConsensus,type TrustedBuildConsensus,type TrustedBuildSourceEvidence,type TrustedBuildSourceName} from '@/lib/buildConsensus';

const CACHE_TTL_MS=15*60_000;
const REQUEST_TIMEOUT_MS=1800;
const cache=new Map<string,{at:number,value:TrustedBuildConsensus}>();

const roleSlug=(role:string)=>{
  const r=String(role||'').trim().toUpperCase();
  if(r==='ADC'||r==='BOTTOM')return'adc';
  if(r==='SUPPORT'||r==='UTILITY')return'support';
  if(r==='MIDDLE'||r==='MID')return'mid';
  if(r==='JUNGLE')return'jungle';
  if(r==='TOP')return'top';
  return'adc';
};
const lolalyticsLane=(role:string)=>roleSlug(role)==='adc'?'bottom':roleSlug(role);
const champSlug=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
const decode=(html:string)=>html
  .replace(/&amp;/gi,'&')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&quot;/gi,'"')
  .replace(/&nbsp;/gi,' ')
  .replace(/\\u0026/g,'&');

function patchReported(html:string){
  const text=decode(html).replace(/<[^>]*>/g,' ');
  return /\bPatch\s+(\d{2}\.\d+)\b/i.exec(text)?.[1]??null;
}
function patchCompatible(expected:string,reported:string|null){
  if(!reported)return true;
  const exp=String(expected).match(/(\d+)\.(\d+)/);
  const rep=String(reported).match(/(\d+)\.(\d+)/);
  if(!exp||!rep)return true;
  if(exp[0]===rep[0])return true;
  // Riot/Data Dragon and public stat sites can expose different season-major
  // labels while still referring to the same live balance patch. Do not let a
  // major-label mismatch override a matching patch sequence number.
  return exp[2]===rep[2];
}
function sampleSize(html:string){
  const text=decode(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  const matches=[...text.matchAll(/([\d,]{3,})\s+(?:Games|Matches)\b/gi)]
    .map(match=>Number(match[1].replace(/,/g,'')))
    .filter(Number.isFinite);
  return matches.length?Math.max(...matches):null;
}
function anchorSlice(html:string,anchors:string[]){
  const lower=html.toLowerCase();
  for(const anchor of anchors){
    const idx=lower.indexOf(anchor.toLowerCase());
    if(idx>=0)return html.slice(idx,idx+90_000);
  }
  return html.slice(0,140_000);
}
function itemSequence(html:string,itemNames:string[],anchors:string[]){
  const area=decode(anchorSlice(html,anchors)).toLowerCase();
  const found=itemNames
    .map(name=>({name,index:area.indexOf(decode(name).toLowerCase())}))
    .filter(row=>row.index>=0)
    .sort((a,b)=>a.index-b.index);
  const unique:string[]=[];
  for(const row of found){
    if(unique.some(name=>name.toLowerCase()===row.name.toLowerCase()))continue;
    unique.push(row.name);
    if(unique.length>=6)break;
  }
  return unique;
}

async function fetchHtml(url:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(url,{
      signal:controller.signal,
      cache:'no-store',
      headers:{
        'user-agent':'OP-CLIMB/1.0 build-consensus (+https://opclimb.com)',
        'accept':'text/html,application/xhtml+xml',
      },
    });
    if(!response.ok)throw new Error('HTTP '+String(response.status));
    return await response.text();
  }finally{clearTimeout(timer)}
}

async function sourceEvidence(input:{
  source:TrustedBuildSourceName;
  url:string;
  anchors:string[];
  itemNames:string[];
  expectedPatch:string;
}):Promise<TrustedBuildSourceEvidence>{
  const fetchedAt=new Date().toISOString();
  try{
    const html=await fetchHtml(input.url);
    const reported=patchReported(html);
    const items=itemSequence(html,input.itemNames,input.anchors);
    const fresh=patchCompatible(input.expectedPatch,reported);
    const sample=sampleSize(html);
    const usable=fresh&&items.length>=2;
    return{
      source:input.source,url:input.url,items,patchReported:reported,sample,fetchedAt,usable,
      note:!fresh?'Patch mismatch':items.length<2?'Could not resolve a stable item sequence':'Current-patch build evidence',
    };
  }catch(error){
    return{
      source:input.source,url:input.url,items:[],patchReported:null,sample:null,fetchedAt,usable:false,
      note:'Source unavailable: '+String((error as Error)?.message||error),
    };
  }
}

export async function trustedBuildConsensus(input:{
  patch:string;
  champion:string;
  role:string;
  itemNames:string[];
}):Promise<TrustedBuildConsensus>{
  const key=[input.patch,input.champion,input.role].join('|').toLowerCase();
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.at<CACHE_TTL_MS)return cached.value;
  const slug=champSlug(input.champion),role=roleSlug(input.role),lane=lolalyticsLane(input.role);
  const sources=await Promise.all([
    sourceEvidence({
      source:'U.GG',
      url:'https://u.gg/lol/champions/'+slug+'/build/'+role,
      anchors:['Core Items','Item 1','Starting Items'],
      itemNames:input.itemNames,expectedPatch:input.patch,
    }),
    sourceEvidence({
      source:'LOLALYTICS',
      url:'https://lolalytics.com/lol/'+slug+'/build/?lane='+lane,
      anchors:['Popular Items','Item 1','Items'],
      itemNames:input.itemNames,expectedPatch:input.patch,
    }),
    sourceEvidence({
      source:'OP.GG',
      url:'https://op.gg/lol/champions/'+slug+'/build/'+role,
      anchors:['Core builds','Core Builds','Builds Table Core builds'],
      itemNames:input.itemNames,expectedPatch:input.patch,
    }),
  ]);
  const value=buildTrustedConsensus({patch:input.patch,champion:input.champion,role:input.role,sources});
  cache.set(key,{at:Date.now(),value});
  return value;
}
