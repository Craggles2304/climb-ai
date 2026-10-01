import type {DnaDomain,ILPTask,IssueCategory} from './types';

export const DNA_DOMAINS:DnaDomain[]=[
  'LANING',
  'WAVES_CS',
  'VISION_MAP',
  'OBJECTIVES',
  'TEAMFIGHTS',
  'CONSISTENCY',
];

export const DNA_DOMAIN_LABELS:Record<DnaDomain,string>={
  LANING:'Laning',
  WAVES_CS:'Waves & CS',
  VISION_MAP:'Vision & Map',
  OBJECTIVES:'Objectives',
  TEAMFIGHTS:'Teamfights',
  CONSISTENCY:'Consistency',
};

export const DNA_DOMAIN_COLORS:Record<DnaDomain,string>={
  LANING:'#b6ff2e',
  WAVES_CS:'#00f5d4',
  VISION_MAP:'#a46bff',
  OBJECTIVES:'#ffb21e',
  TEAMFIGHTS:'#ff3d71',
  CONSISTENCY:'#2ec7ff',
};


export const DNA_DOMAIN_GUIDE:Record<DnaDomain,{summary:string;purpose:string;subskills:string[]}>={
  LANING:{
    summary:'How you create, protect and convert advantages before the map opens up.',
    purpose:'This strand reads your lane decisions: trades, matchup understanding, early positioning and whether you give away avoidable early deaths.',
    subskills:['Trading','Matchups','Lane positioning','Early survival'],
  },
  WAVES_CS:{
    summary:'How you control waves and turn safe resources into gold, recalls and item timings.',
    purpose:'This strand tracks farming, wave states, recall timing, resource collection and whether your economy stays healthy after lane.',
    subskills:['Farming','Wave management','Recall timing','Item timings'],
  },
  VISION_MAP:{
    summary:'How well you gather and use information before you commit.',
    purpose:'This strand measures map awareness, tracking and vision habits so your decisions are based on what is actually happening around you.',
    subskills:['Map awareness','Vision','Tracking','Information use'],
  },
  OBJECTIVES:{
    summary:'How you prepare for and convert pressure around the things that win the map.',
    purpose:'This strand covers objective readiness, tempo and whether your waves, recalls and movement leave you ready for dragons, Herald, Baron and towers.',
    subskills:['Objective setup','Tempo','Arrival timing','Pressure conversion'],
  },
  TEAMFIGHTS:{
    summary:'How you position, survive and make decisions when teams collide.',
    purpose:'This strand reads positioning, target selection, fight selection and death control so your mechanics happen from a playable position.',
    subskills:['Positioning','Target selection','Fight selection','Death control'],
  },
  CONSISTENCY:{
    summary:'Whether good decisions become habits that survive different games and situations.',
    purpose:'This strand is about repeatability: recovery after mistakes, champion mastery, transferring a lesson into new situations and eventually doing it without a reminder.',
    subskills:['Repeatability','Recovery','Transfer','Autonomy'],
  },
};

export const DNA_DOMAIN_GENE:Record<DnaDomain,'lane'|'wave'|'vision'|'obj'|'fight'|'mind'>={
  LANING:'lane',
  WAVES_CS:'wave',
  VISION_MAP:'vision',
  OBJECTIVES:'obj',
  TEAMFIGHTS:'fight',
  CONSISTENCY:'mind',
};

const DEFAULT_DOMAIN:Record<IssueCategory,DnaDomain>={
  LANING:'LANING',
  TRADING:'LANING',
  MATCHUPS:'LANING',
  FARMING:'WAVES_CS',
  WAVE_MANAGEMENT:'WAVES_CS',
  RESOURCE_COLLECTION:'WAVES_CS',
  RECALL_TIMING:'WAVES_CS',
  ITEMISATION:'WAVES_CS',
  VISION:'VISION_MAP',
  MAP_AWARENESS:'VISION_MAP',
  OBJECTIVES:'OBJECTIVES',
  TEMPO:'OBJECTIVES',
  TEAMFIGHTING:'TEAMFIGHTS',
  TARGET_SELECTION:'TEAMFIGHTS',
  POSITIONING:'TEAMFIGHTS',
  DEATHS:'TEAMFIGHTS',
  CHAMPION_MASTERY:'CONSISTENCY',
  CONSISTENCY:'CONSISTENCY',
};

export function dnaDomainForCategory(category:IssueCategory):DnaDomain{
  return DEFAULT_DOMAIN[category]??'CONSISTENCY';
}

export function dnaDomainForTask(task:Pick<ILPTask,'category'|'metric'|'title'>|{category:IssueCategory;metric?:string;title?:string}):DnaDomain{
  const metric=String(task.metric||'').toLowerCase();
  const title=String(task.title||'').toLowerCase();

  if(task.category==='DEATHS'){
    if(metric==='deathspre10'||title.includes('10 minute')||title.includes('opening'))return'LANING';
    if(metric==='historical_recovery'||metric==='chain_deaths'||title.includes('second death')||title.includes('recovery'))return'CONSISTENCY';
    return'TEAMFIGHTS';
  }
  if(task.category==='POSITIONING'&&(title.includes('lane')||title.includes('trade')))return'LANING';
  if(task.category==='TEMPO'&&(metric==='farm_fight_tradeoff'||title.includes('wave')||title.includes('farm')))return'WAVES_CS';

  return dnaDomainForCategory(task.category);
}

export function ensureDnaDomain<T extends {category:IssueCategory;metric?:string;title?:string;dnaDomain?:DnaDomain}>(task:T):T&DnaDomainStamped{
  return{...task,dnaDomain:task.dnaDomain??dnaDomainForTask(task)};
}

export type DnaDomainStamped={dnaDomain:DnaDomain};

export function dnaDomainLabel(domain:DnaDomain){return DNA_DOMAIN_LABELS[domain]}
export function dnaGeneForTask(task:Pick<ILPTask,'dnaDomain'>){return DNA_DOMAIN_GENE[task.dnaDomain]}
