import type {ChampionDetail,ChampionListEntry,RangeClass} from './ddragon';
import {championProfile} from './profile';

export interface TeamPickInput{name:string;role?:string|null;lockedIn?:boolean}
export interface TeamPickView{name:string;role:string|null;lockedIn:boolean}
export interface PregameTeamPlan{
  version:1;
  ourTeam:TeamPickView[];
  theirTeam:TeamPickView[];
  known:{allies:number;enemies:number};
  ourIdentity:string;
  theirIdentity:string;
  teamfight:{label:string;summary:string};
  sidelane:{label:string;summary:string};
  startFight:string;
  yourJob:string;
  playAround:string;
  theirWinCondition:string;
  biggestThrow:string;
  note:string;
}

type Read={name:string;role:string|null;lockedIn:boolean;tags:string[];range:RangeClass;difficulty:number};

export function buildPregameTeamPlan(input:{
  localChampion:string;
  localRole?:string|null;
  allies:TeamPickInput[];
  enemies:TeamPickInput[];
  details:Map<string,ChampionDetail>;
  roster:Record<string,ChampionListEntry>;
}):PregameTeamPlan{
  const allies=input.allies.filter(p=>p.name).map(p=>read(p,input.details,input.roster));
  const enemies=input.enemies.filter(p=>p.name).map(p=>read(p,input.details,input.roster));
  const me=allies.find(p=>same(p.name,input.localChampion))??read({name:input.localChampion,role:input.localRole,lockedIn:true},input.details,input.roster);
  const ours=shape(allies),theirs=shape(enemies);
  const ourIdentity=identity(ours);
  const theirIdentity=enemies.length?identity(theirs):'Enemy composition still forming';
  const teamfight=teamfightPlan(ours,enemies.length);
  const sidelane=sidelanePlan(me,ours);
  const initiators=allies.filter(p=>isFrontline(p)||p.role==='JUNGLE'||p.role==='SUPPORT').slice(0,2).map(p=>p.name);
  const carries=allies.filter(p=>isCarry(p)).slice(0,2).map(p=>p.name);

  return{
    version:1,
    ourTeam:allies.map(view),
    theirTeam:enemies.map(view),
    known:{allies:allies.length,enemies:enemies.length},
    ourIdentity,
    theirIdentity,
    teamfight,
    sidelane,
    startFight:initiators.length
      ?`${initiators.join(' / ')} should usually create first contact. Your damage dealers should not have to walk in first.`
      :`Your comp has no obvious front line from static champion roles. Prefer enemy mistakes, range pressure or a clean pick over a blind 5v5 engage.`,
    yourJob:jobFor(me,ours,theirs),
    playAround:carries.length&&initiators.length
      ?`Let ${initiators[0]} create space, then keep ${carries.join(' / ')} able to deal damage. The formation matters more than reaching the enemy back line instantly.`
      :carries.length
        ?`Keep ${carries.join(' / ')} alive and connected to the fight. Your comp gets more value from sustained damage than from five separate engages.`
        :`Stay connected to the strongest part of your formation. Do not split the team into isolated mini-fights.`,
    theirWinCondition:enemyWinCondition(theirs,enemies.length),
    biggestThrow:throwCondition(me,ours,theirs,enemies.length),
    note:enemies.length<5
      ?`Team read is provisional (${enemies.length}/5 enemy champions known). It updates as champ select reveals more picks.`
      :`Full 5v5 composition read from locked champion data. It does not react to live positioning, cooldowns or hidden information.`,
  };
}

function read(p:TeamPickInput,details:Map<string,ChampionDetail>,roster:Record<string,ChampionListEntry>):Read{
  const detail=details.get(key(p.name));
  if(!detail)return{name:p.name,role:role(p.role),lockedIn:Boolean(p.lockedIn),tags:[],range:'RANGED',difficulty:0};
  const profile=championProfile(detail,roster);
  return{name:detail.name,role:role(p.role),lockedIn:Boolean(p.lockedIn),tags:detail.tags??[],range:profile.rangeClass,difficulty:detail.info?.difficulty??0};
}
function view(p:Read):TeamPickView{return{name:p.name,role:p.role,lockedIn:p.lockedIn}}
function shape(team:Read[]){
  return{
    size:team.length,
    frontline:team.filter(isFrontline).length,
    carry:team.filter(isCarry).length,
    dive:team.filter(isDive).length,
    poke:team.filter(isPoke).length,
    assassins:team.filter(p=>p.tags.includes('Assassin')).length,
    marksmen:team.filter(p=>p.tags.includes('Marksman')).length,
    mages:team.filter(p=>p.tags.includes('Mage')).length,
    tanks:team.filter(p=>p.tags.includes('Tank')).length,
    melee:team.filter(p=>p.range==='MELEE').length,
    long:team.filter(p=>p.range==='LONG'||p.range==='RANGED').length,
  };
}
function identity(s:ReturnType<typeof shape>){
  if(!s.size)return'Composition still forming';
  if(s.frontline>=1&&s.carry>=2&&s.dive>=2)return'Layered front-to-back + dive';
  if(s.frontline>=2&&s.carry>=2)return'Front-to-back teamfight';
  if(s.dive>=3)return'Dive and collapse';
  if(s.poke>=3&&s.frontline<=1)return'Poke and pressure';
  if(s.assassins>=2)return'Pick and burst';
  if(s.frontline>=1&&s.carry>=1)return'Balanced 5v5';
  return'Flexible / skirmish-heavy';
}
function teamfightPlan(ours:ReturnType<typeof shape>,enemyCount:number){
  if(ours.frontline>=1&&ours.carry>=2&&ours.dive>=2){
    return{label:'LAYERED 5V5',summary:'Your back line should play front-to-back while your divers threaten deeper targets after first contact. Do not make the back line follow a solo dive.'};
  }
  if(ours.frontline>=1&&ours.carry>=2)return{label:'FRONT TO BACK',summary:'Keep a connected formation. Let your front line absorb first contact and let your carries hit the nearest safe target before anyone chases deeper.'};
  if(ours.dive>=3)return{label:'DIVE & COLLAPSE',summary:'Your comp gets value when multiple members enter together. Do not send one diver early and turn the fight into separate 1v5s.'};
  if(ours.poke>=3)return{label:'POKE THEN COMMIT',summary:'Use range to lower HP or force space before committing. A neutral full-health engage wastes the part of the composition that is strongest.'};
  if(ours.assassins>=2)return{label:'PICK & RESET',summary:'Create a numbers advantage before the full fight where possible. Avoid standing front-to-back into a more durable five-player formation.'};
  return{label:enemyCount<3?'FORMATION TBD':'CONTROLLED 5V5',summary:'Stay connected, let the first clean engage or enemy overstep define the fight, and avoid splitting damage across unrelated targets.'};
}
function sidelanePlan(me:Read,ours:ReturnType<typeof shape>){
  if(me.role==='SUPPORT'||me.role==='JUNGLE')return{label:'GROUP / SET UP',summary:'You are not the primary side-laner. Stay connected to vision, objectives and the players your kit enables.'};
  if(me.role==='ADC')return{label:'CATCH, THEN GROUP',summary:'Take safe side-wave income when the map allows, but do not become the deepest side-laner. Your highest-value job is arriving to grouped fights with farm and items.'};
  if(me.role==='TOP'&&(me.tags.includes('Fighter')||me.tags.includes('Assassin')))return{label:'SIDE PRESSURE OPTION',summary:'You can be the natural side-lane pressure point between major grouped moments. Do not stay isolated when your team needs your engage or front line.'};
  if(me.role==='MID'&&me.tags.includes('Assassin'))return{label:'SIDE PRESSURE → MOVE',summary:'Use side-lane farm and pressure to create the first move, then reconnect before the main fight starts.'};
  if(me.role==='MID'&&me.tags.includes('Mage'))return{label:'CATCH WAVE → GROUP',summary:'Collect side waves without becoming stranded. Your control and damage are usually worth more when the five-player formation is intact.'};
  return{label:ours.frontline>=1?'BALANCED SIDE / GROUP':'GROUP MORE OFTEN',summary:'Take guaranteed side-wave resources when safe, but prioritise being present for the fights your composition is built to take.'};
}
function jobFor(me:Read,ours:ReturnType<typeof shape>,theirs:ReturnType<typeof shape>){
  if(me.role==='ADC'||me.tags.includes('Marksman'))return theirs.dive>=2
    ?'SURVIVE THE DIVE → DPS. Keep range, hit the nearest safe target and make their divers cross your team before they reach you.'
    :'SAFE DPS. Play behind first contact, hit what is reachable and do not walk past the enemy front line just to reach a carry.';
  if(me.tags.includes('Tank')&&(me.role==='TOP'||me.role==='SUPPORT'||me.role==='JUNGLE'))return theirs.dive>=2
    ?'PEEL FIRST. Their composition wants access to your carries, so your body and control are often worth more protecting the back line than diving alone.'
    :'CREATE FIRST CONTACT. Give your carries a safe front edge, then decide whether the fight needs engage or peel.';
  if(me.tags.includes('Assassin'))return'WAIT → ENTER SECOND. Let key control and first contact happen, then threaten the isolated back-line target instead of opening the fight yourself.';
  if(me.tags.includes('Mage'))return ours.frontline>=1
    ?'CONTROL THE SPACE BEHIND FRONTLINE. Preserve range, layer damage/control after engage and avoid being the first champion visible in the fight.'
    :'CREATE RANGE PRESSURE. Make them spend HP or cooldowns reaching you before your team commits.';
  if(me.tags.includes('Fighter'))return'CONNECT THE FIGHT. Enter with your front line or punish whoever crosses into your team; avoid a solo dive that leaves your back line exposed.';
  return'STAY CONNECTED. Play your champion around the team formation rather than turning the fight into an isolated duel.';
}
function enemyWinCondition(theirs:ReturnType<typeof shape>,count:number){
  if(!count)return'Waiting for enemy picks.';
  if(theirs.dive>=3)return'They want simultaneous access to your back line. Their best fight is one where your carries are separated from peel.';
  if(theirs.poke>=3)return'They want to lower your team before the engage. Their best fight starts after you have already lost HP walking into range.';
  if(theirs.frontline>=2&&theirs.carry>=2)return'They want a stable front-to-back fight where their carries can free-hit behind durable first contact.';
  if(theirs.assassins>=2)return'They want a pick or isolated target before the full 5v5. Their cleanest win is breaking your formation first.';
  return'They want the fight that best fits their individual champions. Do not give them isolated targets or a disconnected formation for free.';
}
function throwCondition(me:Read,ours:ReturnType<typeof shape>,theirs:ReturnType<typeof shape>,enemyCount:number){
  if(me.role==='ADC'||me.tags.includes('Marksman'))return'Walking past your safe damage line to reach a lower-health carry. If you die first, your item lead and power spikes disappear from the fight.';
  if(theirs.dive>=2)return'Letting your formation split so their divers reach the back line without crossing peel.';
  if(ours.dive>=3)return'Staggering the engage. Your dive comp needs multiple threats arriving together, not one champion entering three seconds early.';
  if(ours.poke>=3)return'Hard-engaging from full health before your range advantage has created any pressure.';
  if(enemyCount<5)return'Overcommitting to a team read before all enemy champions are known. Use this as a provisional plan until champ select finishes.';
  return'Breaking formation for a low-value chase after the original fight advantage has already ended.';
}
function isFrontline(p:Read){return p.tags.includes('Tank')||(p.tags.includes('Fighter')&&p.range==='MELEE')}
function isCarry(p:Read){return p.tags.includes('Marksman')||p.tags.includes('Mage')||p.tags.includes('Assassin')}
function isDive(p:Read){return p.tags.includes('Assassin')||(p.tags.includes('Fighter')&&p.range==='MELEE')}
function isPoke(p:Read){return p.range==='LONG'||p.range==='RANGED'||p.tags.includes('Mage')||p.tags.includes('Marksman')}
function role(value?:string|null){const r=(value??'').trim().toUpperCase();if(r==='BOTTOM'||r==='ADC')return'ADC';if(r==='UTILITY'||r==='SUPPORT')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null}
function key(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
function same(a:string,b:string){return key(a)===key(b)}
