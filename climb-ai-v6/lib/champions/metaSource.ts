import 'server-only';

export interface MetaPerk{
  id:number;
  name:string;
  icon:string;
}

export interface MetaItem{
  id:number;
  name:string;
  icon?:string;
}

export interface ChampionMetaResult{
  source:'OP.GG';
  patch:string;
  role:string;
  runePage:{
    pickRate:number|null;
    winRate:number|null;
    perks:MetaPerk[];
  }|null;
  summoners:Array<{id:number;name:string;icon:string}>;
  starters:MetaItem[];
  skillPriority:string[];
  skillSequence:string[];
  summary:{
    winRate:number|null;
    pickRate:number|null;
    banRate:number|null;
    games:number|null;
  };
}

interface BuildItemLike{id:number;name:string;icon?:string}

const ROLE_TO_POS:Record<string,string>={
  TOP:'top',JUNGLE:'jungle',MID:'mid',MIDDLE:'mid',
  ADC:'adc',BOTTOM:'adc',BOT:'adc',SUPPORT:'support',UTILITY:'support',
};

export async function championMeta({
  champion,role,patch,catalogue,
}:{
  champion:string;
  role?:string;
  patch:string;
  catalogue:BuildItemLike[];
}):Promise<ChampionMetaResult|null>{
  const pos=ROLE_TO_POS[String(role||'MID').toUpperCase()]||'mid';
  const slug=championSlug(champion);
  const url=`https://lol-api-champion.op.gg/api/global/champions/ranked/${slug}/${pos}`;

  try{
    const response=await fetch(url,{
      headers:{
        Accept:'application/json',
        'User-Agent':'Mozilla/5.0 (compatible; OPCLIMB/1.0; +https://opclimb.com)',
      },
      next:{revalidate:60*60*2},
    });
    if(!response.ok){
      console.warn('[champion-meta] OP.GG HTTP failure',{status:response.status,url});
      return null;
    }
    const json=await response.json() as any;
    const data=json?.data??{};

    const [perkMap,summonerMap]=await Promise.all([
      loadPerks(patch),
      loadSummoners(patch),
    ]);

    const rune=data.runes?.[0]??null;
    const perkIds=[
      ...(Array.isArray(rune?.primary_rune_ids)?rune.primary_rune_ids:[]),
      ...(Array.isArray(rune?.secondary_rune_ids)?rune.secondary_rune_ids:[]),
      ...(Array.isArray(rune?.stat_mod_ids)?rune.stat_mod_ids:[]),
    ].map(Number).filter(Number.isFinite);
    const perks=perkIds.map(id=>perkMap.get(id)).filter(Boolean) as MetaPerk[];

    const summonerEntry=data.summoner_spells?.[0]??null;
    const summonerIds=extractIds(summonerEntry);
    const summoners=summonerIds
      .map(id=>summonerMap.get(id))
      .filter(Boolean) as Array<{id:number;name:string;icon:string}>;

    const starterEntry=data.starter_items?.[0]??null;
    const itemMap=new Map(catalogue.map(item=>[item.id,item]));
    const starters=extractIds(starterEntry)
      .map(id=>itemMap.get(id))
      .filter(Boolean)
      .map(item=>({id:item!.id,name:item!.name,icon:item!.icon}));

    const skillMastery=data.skill_masteries?.[0]??null;
    const topSkill=data.skills?.[0]??null;
    const skillPriority=(Array.isArray(skillMastery?.ids)?skillMastery.ids:[])
      .map(normaliseSkillSlot).filter(Boolean) as string[];
    const skillSequence=(Array.isArray(topSkill?.order)?topSkill.order:[])
      .map(normaliseSkillSlot).filter(Boolean) as string[];

    const summary=data.summary??{};
    const pct=(value:unknown)=>{
      const n=Number(value);
      if(!Number.isFinite(n))return null;
      return Math.round((n<=1?n*100:n)*10)/10;
    };

    return{
      source:'OP.GG',
      patch,
      role:pos.toUpperCase(),
      runePage:rune?{
        pickRate:pct(rune.pick_rate),
        winRate:rune.play?Math.round((Number(rune.win||0)/Math.max(1,Number(rune.play)))*1000)/10:null,
        perks,
      }:null,
      summoners,
      starters,
      skillPriority,
      skillSequence,
      summary:{
        winRate:pct(summary.win_rate),
        pickRate:pct(summary.pick_rate),
        banRate:pct(summary.ban_rate),
        games:Number.isFinite(Number(summary.play))?Number(summary.play):null,
      },
    };
  }catch(error){
    console.warn('[champion-meta] OP.GG request failed',String(error));
    return null;
  }
}

function extractIds(entry:any):number[]{
  if(!entry)return[];
  const raw=entry.ids??entry.item_ids??entry.spell_ids??entry.summoner_spell_ids??[];
  return Array.isArray(raw)?raw.map(Number).filter(Number.isFinite):[];
}

function normaliseSkillSlot(value:unknown):string{
  if(typeof value==='string'){
    const upper=value.toUpperCase();
    if(['Q','W','E','R'].includes(upper))return upper;
  }
  const n=Number(value);
  if(n===1)return'Q';
  if(n===2)return'W';
  if(n===3)return'E';
  if(n===4)return'R';
  return'';
}

async function loadPerks(patch:string):Promise<Map<number,MetaPerk>>{
  const url=`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/runesReforged.json`;
  const response=await fetch(url,{next:{revalidate:60*60*12}});
  if(!response.ok)return new Map();
  const trees=await response.json() as any[];
  const map=new Map<number,MetaPerk>();
  for(const tree of trees??[]){
    for(const slot of tree?.slots??[]){
      for(const rune of slot?.runes??[]){
        const id=Number(rune?.id);
        if(!Number.isFinite(id))continue;
        map.set(id,{
          id,
          name:String(rune?.name||id),
          icon:`https://ddragon.leagueoflegends.com/cdn/img/${String(rune?.icon||'')}`,
        });
      }
    }
  }
  return map;
}

async function loadSummoners(patch:string){
  const url=`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/summoner.json`;
  const response=await fetch(url,{next:{revalidate:60*60*12}});
  if(!response.ok)return new Map<number,{id:number;name:string;icon:string}>();
  const json=await response.json() as any;
  const map=new Map<number,{id:number;name:string;icon:string}>();
  for(const spell of Object.values(json?.data??{}) as any[]){
    const key=Number(spell?.key);
    const image=String(spell?.image?.full||'');
    if(!Number.isFinite(key)||!image)continue;
    map.set(key,{
      id:key,
      name:String(spell?.name||key),
      icon:`https://ddragon.leagueoflegends.com/cdn/${patch}/img/spell/${image}`,
    });
  }
  return map;
}

function championSlug(name:string){
  return String(name||'').toLowerCase().replace(/['\s.]/g,'').replace(/&/g,'and');
}
