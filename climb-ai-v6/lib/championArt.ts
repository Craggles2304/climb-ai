/**
 * Champion artwork from Riot's public Data Dragon CDN (versionless image paths).
 *
 * Stored matches name a champion in one of two ways: Riot MATCH-V5 sync stores
 * the Data Dragon id ("MonkeyKing", "Khazix"), the live tracker stores the
 * display name ("Wukong", "Kha'Zix"). Every helper accepts either.
 */
const DISPLAY_TO_ID:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',
  "K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',
  LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw',
  "Kha'Zix":'Khazix','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune',
  'Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol',
  'Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao',
};
const ID_TO_DISPLAY:Record<string,string>=Object.fromEntries(Object.entries(DISPLAY_TO_ID).map(([name,id])=>[id,name]));
/** Ids whose display name is not just the id with spaces before capitals. */
const IRREGULAR_IDS=new Set(Object.values(DISPLAY_TO_ID));

const CDN='https://ddragon.leagueoflegends.com/cdn/img/champion/';

/** The Data Dragon id for a champion given either form of its name; '' when unknown. */
export function championAssetId(name:string|null|undefined){
  const value=String(name??'').trim();
  if(!value||value.toLowerCase()==='unknown')return '';
  if(DISPLAY_TO_ID[value])return DISPLAY_TO_ID[value];
  const lower=value.toLowerCase();
  const known=Object.values(DISPLAY_TO_ID).find(id=>id.toLowerCase()===lower);
  if(known)return known;
  return value.replace(/[^A-Za-z0-9]/g,'');
}

/** The name a player reads, given either form; Data Dragon ids are expanded ("MissFortune" → "Miss Fortune"). */
export function championDisplayName(name:string|null|undefined){
  const value=String(name??'').trim();
  if(!value)return 'Unknown';
  if(ID_TO_DISPLAY[value])return ID_TO_DISPLAY[value];
  if(/\s|'|\./.test(value)||IRREGULAR_IDS.has(value))return value;
  return value.replace(/([a-z])([A-Z])/g,'$1 $2');
}

export function championSplash(name:string){
  return CDN+'splash/'+championAssetId(name)+'_0.jpg';
}

/** Square crop of the base skin — the portrait used in rows, cards and the hero. */
export function championTile(name:string){
  const id=championAssetId(name);
  return id?CDN+'tiles/'+id+'_0.jpg':'';
}

/** Splash framed on the champion, for wide backgrounds. */
export function championCentered(name:string){
  const id=championAssetId(name);
  return id?CDN+'centered/'+id+'_0.jpg':'';
}
