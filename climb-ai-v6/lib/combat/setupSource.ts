import 'server-only';

const CACHE_MS=12*60*60_000;
let cache:{patch:string;expires:number;value:MatchupSetupCatalogue}|null=null;

export interface SetupRune{
  id:number;
  name:string;
  icon:string;
  treeId:number;
  treeName:string;
  slot:number;
}

export interface SetupSummoner{
  id:string;
  key:number;
  name:string;
  description:string;
  image:string|null;
  cooldown:number|null;
}

export interface MatchupSetupCatalogue{
  runes:SetupRune[];
  summoners:SetupSummoner[];
}

interface RuneFile{
  id:number;
  key:string;
  name:string;
  icon:string;
  slots:{runes:{id:number;key:string;name:string;icon:string}[]}[];
}

interface SummonerFileEntry{
  id:string;
  key:string;
  name:string;
  description?:string;
  cooldown?:number[];
  modes?:string[];
  image?:{full?:string};
}

/** Current-patch rune and summoner choices for the matchup configurator. */
export async function matchupSetupCatalogue(patch:string):Promise<MatchupSetupCatalogue>{
  if(cache&&cache.patch===patch&&cache.expires>Date.now())return cache.value;

  const base=`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US`;
  const [runeRes,summonerRes]=await Promise.all([
    fetch(`${base}/runesReforged.json`,{cache:'no-store'}),
    fetch(`${base}/summoner.json`,{cache:'no-store'}),
  ]);
  if(!runeRes.ok)throw new Error(`Data Dragon rune request failed (${runeRes.status}).`);
  if(!summonerRes.ok)throw new Error(`Data Dragon summoner request failed (${summonerRes.status}).`);

  const runeTrees=await runeRes.json() as RuneFile[];
  const summonerPayload=await summonerRes.json() as {data:Record<string,SummonerFileEntry>};

  const runes:SetupRune[]=[];
  for(const tree of runeTrees)
    tree.slots.forEach((slot,slotIndex)=>
      slot.runes.forEach(rune=>runes.push({
        id:rune.id,
        name:rune.name,
        icon:rune.icon,
        treeId:tree.id,
        treeName:tree.name,
        slot:slotIndex,
      })));

  const summoners=Object.values(summonerPayload.data)
    .filter(spell=>!spell.modes||spell.modes.includes('CLASSIC'))
    .filter(spell=>!/^SummonerSmiteAvatar/.test(spell.id))
    .map(spell=>({
      id:spell.id,
      key:Number(spell.key)||0,
      name:spell.name,
      description:clean(spell.description??''),
      image:spell.image?.full??null,
      cooldown:spell.cooldown?.[0]??null,
    }))
    .sort((a,b)=>a.name.localeCompare(b.name));

  const value={runes,summoners};
  cache={patch,expires:Date.now()+CACHE_MS,value};
  return value;
}

const clean=(html:string)=>html
  .replace(/<br\s*\/?\s*>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ')
  .replace(/&amp;/g,'&')
  .replace(/\s+/g,' ')
  .trim();
