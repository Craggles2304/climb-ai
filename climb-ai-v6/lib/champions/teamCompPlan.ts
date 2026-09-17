import type {ChampionDetail,ChampionListEntry,RangeClass} from './ddragon';
import {championProfile} from './profile';

export interface TeamPickInput{name:string;role?:string|null;lockedIn?:boolean}
export interface TeamPickView{name:string;role:string|null;lockedIn:boolean}
export interface PregameTeamPlan{
  version:1;ourTeam:TeamPickView[];theirTeam:TeamPickView[];known:{allies:number;enemies:number};ourIdentity:string;theirIdentity:string;
  teamfight:{label:string;summary:string};sidelane:{label:string;summary:string};startFight:string;yourJob:string;playAround:string;
  ourWinCondition:string;theirWinCondition:string;biggestThrow:string;note:string;
}
type Read={name:string;role:string|null;lockedIn:boolean;tags:string[];range:RangeClass;difficulty:number};

export function buildPregameTeamPlan(input:{localChampion:string;localRole?:string|null;allies:TeamPickInput[];enemies:TeamPickInput[];details:Map<string,ChampionDetail>;roster:Record<string,ChampionListEntry>}):PregameTeamPlan{
  const allies=input.allies.filter(p=>p.name).map(p=>read(p,input.details,input.roster));
  const enemies=input.enemies.filter(p=>p.name).map(p=>read(p,input.details,input.roster));
  const me=allies.find(p=>same(p.name,input.localChampion))??read({name:input.localChampion,role:input.localRole,lockedIn:true},input.details,input.roster);
  const ours=shape(allies),theirs=shape(enemies),ourIdentity=identity(ours),theirIdentity=enemies.length?identity(theirs):'Enemy composition still forming';
  const teamfight=teamfightPlan(ours,enemies.length),sidelane=sidelanePlan(me,ours);
  const initiators=allies.filter(p=>isFrontline(p)||p.role==='JUNGLE'||p.role==='SUPPORT').slice(0,2).map(p=>p.name);
  const carries=allies.filter(p=>isCarry(p)).slice(0,2).map(p=>p.name);
  const startFight=initiators.length?`${initiators.join(' / ')} should usually create first contact. Your damage dealers should not have to walk in first.`:`Prefer enemy mistakes, range pressure or a clean pick over a blind 5v5 engage.`;
  const playAround=carries.length&&initiators.length?`Let ${initiators[0]} create space, then keep ${carries.join(' / ')} able to deal damage.`:carries.length?`Keep ${carries.join(' / ')} alive and connected to the fight.`:`Stay connected to the strongest part of your formation.`;
  return{version:1,ourTeam:allies.map(view),theirTeam:enemies.map(view),known:{allies:allies.length,enemies:enemies.length},ourIdentity,theirIdentity,teamfight,sidelane,startFight,yourJob:jobFor(me,ours,theirs),playAround,
    ourWinCondition:ourWinCondition(me,ours,theirs,allies,enemies,carries,initiators),theirWinCondition:enemyWinCondition(theirs,enemies.length),biggestThrow:throwCondition(me,ours,theirs,enemies.length),
    note:enemies.length<5?`Team read is provisional (${enemies.length}/5 enemy champions known). It updates as champ select reveals more picks.`:`Full 5v5 composition read from locked champion data. It does not react to live positioning, cooldowns or hidden information.`};
}

function ourWinCondition(me:Read,ours:ReturnType<typeof shape>,theirs:ReturnType<typeof shape>,allies:Read[],enemies:Read[],carries:string[],initiators:string[]){
  if(enemies.length<5)return'Finish the draft read first → build one clean advantage → convert it at the next objective.';
  const carry=carries[0]||allies.find(p=>isCarry(p))?.name||'your strongest carry';
  const starter=initiators[0]||'your front line';
  const role=me.role;
  if(role==='JUNGLE'){
    if(ours.dive>=3)return`Path toward lane priority → create first move into river → secure objectives → ${starter} starts and the dive arrives together.`;
    if(ours.poke>=3)return`Path toward priority → arrive first to objectives → let range soften them → engage only after HP or space is won.`;
    return`Path toward your strongest priority lane → create first move into river → stack objectives → fight connected around ${carry}.`;
  }
  if(role==='ADC')return`Farm safely to your item spike → control mid wave before objectives → arrive with the team → hit front-to-back behind ${starter}.`;
  if(role==='SUPPORT')return`Stabilise lane → move first with jungle → own objective vision → ${starter} creates first contact while ${carry} stays protected.`;
  if(role==='MID')return ours.assassins>=2?`Secure the wave → move first into fog → create a pick before objectives → turn the next fight into a numbers advantage.`:`Secure mid priority → move first to river → control objective entrances → fight behind first contact with ${carry}.`;
  if(role==='TOP')return ours.dive>=3?`Build side pressure → force an answer → move first to the objective → collapse together instead of entering one by one.`:`Build a side-lane edge → reconnect before objectives → give ${carry} a safe front edge → play the fight front-to-back.`;
  if(ours.poke>=3)return'Win space with range → reach objectives first → lower HP before committing → engage only after the poke advantage is real.';
  if(ours.dive>=3)return'Create side or vision pressure → force a separated target → collapse together → convert the numbers edge into the next objective.';
  if(theirs.dive>=2)return`Reach objectives together → keep ${carry} connected to peel → absorb their dive → win the extended front-to-back fight.`;
  return`Create lane priority → move first to objectives → keep the formation connected → let ${carry} deal damage behind first contact.`;
}
function read(p:TeamPickInput,details:Map<string,ChampionDetail>,roster:Record<string,ChampionListEntry>):Read{const detail=details.get(key(p.name));if(!detail)return{name:p.name,role:role(p.role),lockedIn:Boolean(p.lockedIn),tags:[],range:'RANGED',difficulty:0};const profile=championProfile(detail,roster);return{name:detail.name,role:role(p.role),lockedIn:Boolean(p.lockedIn),tags:detail.tags??[],range:profile.rangeClass,difficulty:detail.info?.difficulty??0}}
function view(p:Read):TeamPickView{return{name:p.name,role:p.role,lockedIn:p.lockedIn}}
function shape(team:Read[]){return{size:team.length,frontline:team.filter(isFrontline).length,carry:team.filter(isCarry).length,dive:team.filter(isDive).length,poke:team.filter(isPoke).length,assassins:team.filter(p=>p.tags.includes('Assassin')).length,marksmen:team.filter(p=>p.tags.includes('Marksman')).length,mages:team.filter(p=>p.tags.includes('Mage')).length,tanks:team.filter(p=>p.tags.includes('Tank')).length,melee:team.filter(p=>p.range==='MELEE').length,long:team.filter(p=>p.range==='LONG'||p.range==='RANGED').length}}
function identity(s:ReturnType<typeof shape>){if(!s.size)return'Composition still forming';if(s.frontline>=1&&s.carry>=2&&s.dive>=2)return'Layered front-to-back + dive';if(s.frontline>=2&&s.carry>=2)return'Front-to-back teamfight';if(s.dive>=3)return'Dive and collapse';if(s.poke>=3&&s.frontline<=1)return'Poke and pressure';if(s.assassins>=2)return'Pick and burst';if(s.frontline>=1&&s.carry>=1)return'Balanced 5v5';return'Flexible / skirmish-heavy'}
function teamfightPlan(ours:ReturnType<typeof shape>,enemyCount:number){if(ours.frontline>=1&&ours.carry>=2&&ours.dive>=2)return{label:'LAYERED 5V5',summary:'Back line plays front-to-back; divers enter after first contact.'};if(ours.frontline>=1&&ours.carry>=2)return{label:'FRONT TO BACK',summary:'Keep a connected formation and let carries hit the nearest safe target.'};if(ours.dive>=3)return{label:'DIVE & COLLAPSE',summary:'Enter together; never stagger the engage.'};if(ours.poke>=3)return{label:'POKE THEN COMMIT',summary:'Lower HP or win space before engaging.'};if(ours.assassins>=2)return{label:'PICK & RESET',summary:'Create a numbers advantage before the full fight.'};return{label:enemyCount<3?'FORMATION TBD':'CONTROLLED 5V5',summary:'Stay connected and let the first clean engage define the fight.'}}
function sidelanePlan(me:Read,ours:ReturnType<typeof shape>){if(me.role==='SUPPORT'||me.role==='JUNGLE')return{label:'GROUP / SET UP',summary:'Stay connected to vision, objectives and the players your kit enables.'};if(me.role==='ADC')return{label:'CATCH, THEN GROUP',summary:'Take safe farm, then reconnect before grouped fights.'};if(me.role==='TOP'&&(me.tags.includes('Fighter')||me.tags.includes('Assassin')))return{label:'SIDE PRESSURE OPTION',summary:'Create side pressure, then reconnect when your team needs you.'};if(me.role==='MID'&&me.tags.includes('Assassin'))return{label:'SIDE PRESSURE → MOVE',summary:'Use wave pressure to create first move.'};if(me.role==='MID'&&me.tags.includes('Mage'))return{label:'CATCH WAVE → GROUP',summary:'Collect safe waves without becoming stranded.'};return{label:ours.frontline>=1?'BALANCED SIDE / GROUP':'GROUP MORE OFTEN',summary:'Take safe resources, but be present for the fights your comp is built to take.'}}
function jobFor(me:Read,ours:ReturnType<typeof shape>,theirs:ReturnType<typeof shape>){if(me.role==='JUNGLE')return'CREATE FIRST MOVE. Path toward priority, arrive early to objectives and make your engage match your team follow-up.';if(me.role==='ADC'||me.tags.includes('Marksman'))return theirs.dive>=2?'SURVIVE THE DIVE → DPS. Hit the nearest safe target.':'SAFE DPS. Play behind first contact and hit what is reachable.';if(me.tags.includes('Tank')&&(me.role==='TOP'||me.role==='SUPPORT'))return theirs.dive>=2?'PEEL FIRST. Protect your back line before diving.':'CREATE FIRST CONTACT. Give carries a safe front edge.';if(me.tags.includes('Assassin'))return'WAIT → ENTER SECOND. Threaten isolated carries after first contact.';if(me.tags.includes('Mage'))return ours.frontline>=1?'CONTROL SPACE BEHIND FRONTLINE.':'CREATE RANGE PRESSURE BEFORE COMMITTING.';if(me.tags.includes('Fighter'))return'CONNECT THE FIGHT. Enter with your front line, not alone.';return'STAY CONNECTED. Play around the team formation.'}
function enemyWinCondition(theirs:ReturnType<typeof shape>,count:number){if(!count)return'Waiting for enemy picks.';if(theirs.dive>=3)return'Split your formation → reach your back line together → burst a carry before peel reconnects.';if(theirs.poke>=3)return'Control objective entrances → lower your HP before the fight → force you to engage from a losing state.';if(theirs.frontline>=2&&theirs.carry>=2)return'Force a stable front-to-back fight → keep their carries free-hitting behind durable first contact.';if(theirs.assassins>=2)return'Catch an isolated target before the objective → turn the next fight into a numbers advantage.';return'Create an isolated target or disconnected fight → punish before your formation can reconnect.'}
function throwCondition(me:Read,ours:ReturnType<typeof shape>,theirs:ReturnType<typeof shape>,enemyCount:number){if(me.role==='JUNGLE')return'Entering river late or forcing an objective fight before your lanes can move.';if(me.role==='ADC'||me.tags.includes('Marksman'))return'Walking past your safe damage line to reach a carry.';if(theirs.dive>=2)return'Letting your formation split so their divers reach the back line without crossing peel.';if(ours.dive>=3)return'Staggering the engage instead of arriving together.';if(ours.poke>=3)return'Hard-engaging from full health before range pressure creates an edge.';if(enemyCount<5)return'Overcommitting before all enemy champions are known.';return'Breaking formation for a low-value chase.'}
function isFrontline(p:Read){return p.tags.includes('Tank')||(p.tags.includes('Fighter')&&p.range==='MELEE')}
function isCarry(p:Read){return p.tags.includes('Marksman')||p.tags.includes('Mage')||p.tags.includes('Assassin')}
function isDive(p:Read){return p.tags.includes('Assassin')||(p.tags.includes('Fighter')&&p.range==='MELEE')}
function isPoke(p:Read){return p.range==='LONG'||p.range==='RANGED'||p.tags.includes('Mage')||p.tags.includes('Marksman')}
function role(value?:string|null){const r=(value??'').trim().toUpperCase();if(r==='BOTTOM'||r==='ADC')return'ADC';if(r==='UTILITY'||r==='SUPPORT')return'SUPPORT';if(r==='MIDDLE')return'MID';return r||null}
function key(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
function same(a:string,b:string){return key(a)===key(b)}
