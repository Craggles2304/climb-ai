import type {ChampionDetail} from './ddragon';
import type {RoleWinCondition,TeamPickInput} from './teamCompPlan';

export type CompositionCapability='ENGAGE'|'PEEL'|'DIVE'|'POKE'|'PICK'|'FRONTLINE'|'PROTECT'|'DPS'|'BURST'|'SIDE'|'CONTROL';
export type CompositionStyle='FRONT_TO_BACK'|'DIVE'|'POKE'|'PICK'|'SIDE_PRESSURE'|'CONNECTED_5V5';

export interface CompositionNode{
  name:string;
  role:string|null;
  capabilities:Record<CompositionCapability,number>;
  strengths:CompositionCapability[];
}

export interface CompositionInteraction{
  type:'ENABLES'|'PROTECTS'|'THREATENS'|'DENIES'|'FOLLOWS';
  from:string;
  to:string;
  weight:number;
  reason:string;
}

export interface CompositionRead{
  version:1;
  frozenFromChampSelect:true;
  usesLiveTelemetry:false;
  confidence:'FORMING'|'MEDIUM'|'HIGH';
  localChampion:string;
  localRole:string|null;
  ourStyle:{key:CompositionStyle;label:string};
  theirStyle:{key:CompositionStyle;label:string};
  firstContact:string[];
  protectors:string[];
  damageCore:string[];
  enemyThreats:string[];
  enemyDamageCore:string[];
  fightGeometry:string;
  matchupRule:string;
  interactions:CompositionInteraction[];
}

export interface CompositionStrategyUpgrade{
  roleWinCondition:RoleWinCondition;
  ourWinCondition:string;
  theirWinCondition:string;
  biggestThrow:string;
  compositionRead:CompositionRead;
}

const CAPS:CompositionCapability[]=['ENGAGE','PEEL','DIVE','POKE','PICK','FRONTLINE','PROTECT','DPS','BURST','SIDE','CONTROL'];

type BuildInput={
  localChampion:string;
  localRole?:string|null;
  allies:TeamPickInput[];
  enemies:TeamPickInput[];
  details:Map<string,ChampionDetail>;
  baseRoleWinCondition:RoleWinCondition;
};

export function buildCompositionStrategy(input:BuildInput):CompositionStrategyUpgrade{
  const allies=nodes(input.allies,input.details);
  const enemies=nodes(input.enemies,input.details);
  let local=allies.find(node=>same(node.name,input.localChampion));
  if(!local){
    local=nodeFor({name:input.localChampion,role:input.localRole??null,lockedIn:true},input.details);
    allies.push(local);
  }
  if(!local.role&&input.localRole)local={...local,role:normalizeRole(input.localRole)};

  const ours=teamStyle(allies);
  const theirs=teamStyle(enemies);
  const firstContact=rank(allies.filter(node=>!same(node.name,local.name)),node=>node.capabilities.ENGAGE*1.8+node.capabilities.FRONTLINE+node.capabilities.PICK*.5+node.capabilities.DIVE*.35,2);
  const protectors=rank(allies.filter(node=>!same(node.name,local.name)),node=>node.capabilities.PEEL*1.7+node.capabilities.PROTECT*1.8+node.capabilities.CONTROL*.7+node.capabilities.FRONTLINE*.45,2);
  const damageCore=rank(allies.filter(node=>!same(node.name,local.name)),node=>node.capabilities.DPS*1.7+node.capabilities.BURST+node.capabilities.POKE*.55,2);
  const threats=rank(enemies,node=>threatScore(node,local),3);
  const enemyDamageCore=rank(enemies,node=>node.capabilities.DPS*1.7+node.capabilities.BURST+node.capabilities.POKE*.55,2);

  const firstNames=names(firstContact,'YOUR FRONT LINE');
  const protectorNames=names(protectors,firstNames);
  const damageNames=names(damageCore,local.name);
  const threatNames=names(threats,'THEIR FIRST CLEAN ENGAGE');
  const enemyDamageNames=names(enemyDamageCore,'THEIR DAMAGE LINE');
  const geometry=fightGeometry({ours,theirs,local,firstContact,protectors,damageCore,threats,enemyDamageCore});
  const matchupRule=ruleAgainst(theirs,enemies,threats,enemyDamageCore);
  const roleWinCondition=rolePlan({
    base:input.baseRoleWinCondition,
    local,
    ours,
    theirs,
    firstNames,
    protectorNames,
    damageNames,
    threatNames,
    enemyDamageNames,
    geometry,
    allies,
    enemies,
  });
  const theirWinCondition=enemyWinCondition({theirs,threatNames,enemyDamageNames,protectorNames,local});
  const biggestThrow=lossCondition({local,ours,theirs,threatNames,protectorNames,damageNames,enemyDamageNames});
  const interactions=buildInteractions({local,firstContact,protectors,damageCore,threats,enemyDamageCore});

  return{
    roleWinCondition:{...roleWinCondition,lossCondition:biggestThrow},
    ourWinCondition:roleWinCondition.summary,
    theirWinCondition,
    biggestThrow,
    compositionRead:{
      version:1,
      frozenFromChampSelect:true,
      usesLiveTelemetry:false,
      confidence:enemies.length>=5&&allies.length>=5?'HIGH':enemies.length>=3?'MEDIUM':'FORMING',
      localChampion:local.name,
      localRole:local.role,
      ourStyle:{key:ours.key,label:ours.label},
      theirStyle:{key:theirs.key,label:theirs.label},
      firstContact:firstContact.map(node=>node.name),
      protectors:protectors.map(node=>node.name),
      damageCore:damageCore.map(node=>node.name),
      enemyThreats:threats.map(node=>node.name),
      enemyDamageCore:enemyDamageCore.map(node=>node.name),
      fightGeometry:geometry,
      matchupRule,
      interactions,
    },
  };
}

function rolePlan(input:{
  base:RoleWinCondition;
  local:CompositionNode;
  ours:ReturnType<typeof teamStyle>;
  theirs:ReturnType<typeof teamStyle>;
  firstNames:string;
  protectorNames:string;
  damageNames:string;
  threatNames:string;
  enemyDamageNames:string;
  geometry:string;
  allies:CompositionNode[];
  enemies:CompositionNode[];
}):RoleWinCondition{
  const {base,local,ours,theirs,firstNames,protectorNames,damageNames,threatNames,enemyDamageNames,geometry}=input;
  const conversion='WON FIGHT / PICK → DRAGON, BARON OR TOWER → RESET INSTEAD OF LOW-VALUE CHASE';
  const baseFirst=base.steps[0]?.value||'REACH YOUR FIRST CLEAN POWER WINDOW';
  const role=local.role;

  if(role==='ADC'){
    const damage=ours.key==='POKE'
      ?`POKE FROM SAFETY FIRST → FALL BEHIND ${protectorNames} → DPS THE NEAREST SAFE TARGET`
      :`PLAY BEHIND ${protectorNames} → SURVIVE ${threatNames} → HIT THE NEAREST SAFE TARGET`;
    return makeRole(base,'YOUR ADC WIN CONDITION',[
      ['GET_TO','GET TO',baseFirst],
      ['STAY_WITH','STAY WITH',protectorNames],
      ['SURVIVE','SURVIVE',`${threatNames} — DO NOT STEP OUT BEFORE THEIR ACCESS IS COMMITTED`],
      ['DAMAGE','DAMAGE',damage],
      ['CONVERT','CONVERT',conversion],
    ]);
  }

  if(role==='JUNGLE'){
    const pathTarget=damageNames===local.name?'THE LANE WITH FIRST MOVE':`THE SIDE THAT ENABLES ${damageNames}`;
    const create=ours.key==='DIVE'
      ?`CREATE FIRST MOVE → ENTER WITH ${firstNames} → DO NOT START A SOLO DIVE`
      :ours.key==='PICK'
        ?`CREATE FIRST MOVE → SWEEP VISION → LET ${firstNames} HELP CREATE THE PICK`
        :`CLEAR ON TEMPO → CREATE FIRST MOVE WITH ${firstNames} → ONLY FORCE WHEN LANES CAN CONNECT`;
    return makeRole(base,'YOUR JUNGLE WIN CONDITION',[
      ['PATH_TOWARD','PATH TOWARD',pathTarget],
      ['CREATE','CREATE',create],
      ['CONTROL','CONTROL',`NEXT OBJECTIVE → SMITE READY → ARRIVE WITH ${firstNames} BEFORE SPACE IS LOST`],
      ['EXECUTE','EXECUTE',geometry],
      ['CONVERT','CONVERT',conversion],
    ]);
  }

  if(role==='TOP'){
    const side=local.capabilities.SIDE>=4&&local.capabilities.SIDE>local.capabilities.FRONTLINE;
    const enemyTop=input.enemies.find(node=>node.role==='TOP');
    return makeRole(base,'YOUR TOP WIN CONDITION',[
      ['GET_TO','GET TO',baseFirst],
      ['PRESSURE','PRESSURE',side?'SIDE LANE BETWEEN OBJECTIVES → FORCE A RESPONSE → MOVE FIRST':'WAVE FIRST → GROUP EARLY ENOUGH TO GIVE THE TEAM A FRONT EDGE'],
      ['ANSWER','ANSWER',enemyTop?`${enemyTop.name} ON SIDE / ${threatNames} IN THE FIGHT`:`${threatNames} WITHOUT ARRIVING LATE`],
      ['FIGHT','FIGHT',side?`ENTER AFTER ${firstNames} CREATES CONTACT → THREATEN ${enemyDamageNames}`:geometry],
      ['CONVERT','CONVERT',side?'SIDE PRESSURE → TOWER / NUMBERS EDGE → MAJOR OBJECTIVE':conversion],
    ]);
  }

  if(role==='MID'){
    const assassin=local.capabilities.PICK+local.capabilities.DIVE+local.capabilities.BURST>local.capabilities.POKE+local.capabilities.CONTROL+5;
    return makeRole(base,'YOUR MID WIN CONDITION',[
      ['GET_TO','GET TO',baseFirst],
      ['CREATE','CREATE',assassin?'SIDE WAVE → FOG → FORCE THEIR CARRY TO RESPECT THE PICK':'MID PRIORITY → FIRST MOVE → ENTER OBJECTIVE SPACE BEFORE THEIR MID'],
      ['PLAY_WITH','PLAY WITH',firstNames],
      ['EXECUTE','EXECUTE',assassin?`WAIT FOR FIRST CONTACT → THREATEN ${enemyDamageNames} → DO NOT SHOW FRONT-TO-BACK INTO THEIR PEEL`:geometry],
      ['CONVERT','CONVERT',conversion],
    ]);
  }

  if(role==='SUPPORT'){
    const engage=local.capabilities.ENGAGE>local.capabilities.PEEL+local.capabilities.PROTECT*.7;
    return makeRole(base,'YOUR SUPPORT WIN CONDITION',[
      ['ENABLE','ENABLE',damageNames],
      ['SET_UP','SET UP',`MOVE WITH ${firstNames} → VISION FIRST → GIVE ${damageNames} A SAFE ENTRY`],
      ['STOP','STOP',`${threatNames} REACHING ${damageNames}`],
      ['EXECUTE','EXECUTE',engage?`START WITH ${firstNames} → ONE TARGET → THEN TURN BACK TO ${damageNames}`:geometry],
      ['CONVERT','CONVERT','VISION / PICK / WON FIGHT → OBJECTIVE → RESET TO THE NEXT SIDE'],
    ]);
  }

  return makeRole(base,base.title,[
    [base.steps[0]?.key||'GET_TO',base.steps[0]?.label||'GET TO',baseFirst],
    ['PLAY_WITH','PLAY WITH',firstNames],
    ['SURVIVE','SURVIVE',threatNames],
    ['EXECUTE','EXECUTE',geometry],
    ['CONVERT','CONVERT',conversion],
  ]);
}

function makeRole(base:RoleWinCondition,title:string,raw:Array<[string,string,string]>):RoleWinCondition{
  const steps=raw.map(([key,label,value])=>({key,label,value}));
  return{
    ...base,
    title,
    steps,
    summary:steps.map(step=>step.value).join(' → '),
    compPlan:base.compPlan,
  };
}

function nodeFor(pick:TeamPickInput,details:Map<string,ChampionDetail>):CompositionNode{
  const detail=details.get(key(pick.name));
  const role=normalizeRole(pick.role);
  const scores=blankScores();
  const tags=detail?.tags??[];
  if(tags.includes('Tank'))add(scores,{FRONTLINE:5,ENGAGE:2.5,PEEL:2.5,CONTROL:2.5,PROTECT:1});
  if(tags.includes('Fighter'))add(scores,{FRONTLINE:1.5,DIVE:2.5,SIDE:2.5,ENGAGE:1,BURST:1});
  if(tags.includes('Assassin'))add(scores,{DIVE:4.5,PICK:4.5,BURST:4.5,SIDE:2});
  if(tags.includes('Marksman'))add(scores,{DPS:5,POKE:1.5,BURST:1});
  if(tags.includes('Mage'))add(scores,{POKE:2.5,BURST:2.5,CONTROL:2.5,DPS:1});
  if(tags.includes('Support'))add(scores,{PEEL:2,PROTECT:2.5,CONTROL:2});

  if(role==='SUPPORT')add(scores,{PEEL:2.5,PROTECT:2.5,CONTROL:2,ENGAGE:1.5});
  if(role==='JUNGLE')add(scores,{ENGAGE:1.5,PICK:1,CONTROL:1,DIVE:.75});
  if(role==='TOP')add(scores,{SIDE:1.5,FRONTLINE:.75});
  if(role==='MID')add(scores,{BURST:1,POKE:1,PICK:.5});
  if(role==='ADC')add(scores,{DPS:3,POKE:.5});

  const attackRange=Number(detail?.stats?.attackrange??0);
  if(attackRange>=600)add(scores,{POKE:2});
  else if(attackRange>=500)add(scores,{POKE:1});

  const text=[
    ...(detail?.allytips??[]),
    ...(detail?.enemytips??[]),
    detail?.passive?.description??'',
    ...(detail?.spells??[]).flatMap(spell=>[spell?.name??'',String((spell as any)?.description??'')]),
  ].join(' ').toLowerCase();

  textBoost(scores,text,['initiate','engage','charge','knock up','knockup','taunt','hook','pull','immobilize'],{ENGAGE:1.8,CONTROL:1});
  textBoost(scores,text,['shield','heal','protect','save an ally','protect an ally','ally shield'],{PROTECT:2,PEEL:1.2});
  textBoost(scores,text,['knock back','knockback','displace','slow','root','stun','silence','suppress','charm'],{PEEL:1,CONTROL:1.6});
  textBoost(scores,text,['dash','leap','blink','teleport','backline','back line','dive'],{DIVE:1.7});
  textBoost(scores,text,['long range','long-range','poke','from range','projectile'],{POKE:1.6});
  textBoost(scores,text,['catch','trap','ambush','isolated','pick off'],{PICK:1.7});
  textBoost(scores,text,['attack speed','basic attack','critical strike','sustained damage'],{DPS:1.7});
  textBoost(scores,text,['burst','combo','execute','assassinate'],{BURST:1.5});
  textBoost(scores,text,['duel','1v1','split push','split-push','side lane','tower'],{SIDE:1.6});

  for(const cap of CAPS)scores[cap]=roundScore(Math.min(10,scores[cap]));
  const strengths=[...CAPS].sort((a,b)=>scores[b]-scores[a]).filter(cap=>scores[cap]>=2.5).slice(0,4);
  return{name:detail?.name??pick.name,role,capabilities:scores,strengths};
}

function nodes(picks:TeamPickInput[],details:Map<string,ChampionDetail>){
  return picks.filter(pick=>String(pick?.name??'').trim()).map(pick=>nodeFor(pick,details));
}

function teamStyle(team:CompositionNode[]){
  const total=(cap:CompositionCapability)=>team.reduce((sum,node)=>sum+node.capabilities[cap],0);
  const engage=total('ENGAGE'),dive=total('DIVE'),poke=total('POKE'),pick=total('PICK'),front=total('FRONTLINE'),peel=total('PEEL')+total('PROTECT'),dps=total('DPS'),side=total('SIDE');
  if(team.length&&poke>=14&&poke>=dive+3&&poke>=engage+2)return{key:'POKE' as const,label:'POKE → FORCE'};
  if(team.length&&dive+engage>=22&&dive>=10)return{key:'DIVE' as const,label:'DIVE TOGETHER'};
  if(team.length&&pick>=13&&pick+total('BURST')>=24)return{key:'PICK' as const,label:'PICK → CONVERT'};
  if(team.length&&side>=11&&side>front+2)return{key:'SIDE_PRESSURE' as const,label:'SIDE PRESSURE → COLLAPSE'};
  if(team.length&&front+peel>=16&&dps>=6)return{key:'FRONT_TO_BACK' as const,label:'FRONT-TO-BACK'};
  return{key:'CONNECTED_5V5' as const,label:team.length?'CONNECTED 5V5':'FORMING'};
}

function fightGeometry(input:{ours:ReturnType<typeof teamStyle>;theirs:ReturnType<typeof teamStyle>;local:CompositionNode;firstContact:CompositionNode[];protectors:CompositionNode[];damageCore:CompositionNode[];threats:CompositionNode[];enemyDamageCore:CompositionNode[]}){
  const front=names(input.firstContact,'YOUR FRONT LINE');
  const protect=names(input.protectors,front);
  const damage=names(input.damageCore,input.local.name);
  const threats=names(input.threats,'THEIR ACCESS');
  const enemyDamage=names(input.enemyDamageCore,'THEIR DAMAGE LINE');
  if(input.ours.key==='POKE')return`${damage} CREATES HP / SPACE FIRST → ${front} HOLDS THE FRONT EDGE → COMMIT ONLY AFTER THEY ARE FORCED IN`;
  if(input.ours.key==='DIVE')return`${front} STARTS → ENTER ON THE SAME TARGET → ${damage} FOLLOWS → DO NOT STAGGER THE DIVE`;
  if(input.ours.key==='PICK')return`${front} CONTROLS FOG / FIRST CONTACT → CATCH ${enemyDamage} OR AN ISOLATED TARGET → TAKE THE 5V4`;
  if(input.ours.key==='SIDE_PRESSURE')return`SIDE PRESSURE FORCES A RESPONSE → ${front} HOLDS OBJECTIVE SPACE → COLLAPSE WHEN NUMBERS MOVE`;
  if(input.ours.key==='FRONT_TO_BACK')return`${front} OWNS FIRST CONTACT → ${protect} KEEPS ${damage} CONNECTED → DEAL WITH ${threats} BEFORE CHASING ${enemyDamage}`;
  return`${front} CREATES FIRST CONTACT → ${protect} KEEPS ${damage} CONNECTED → FOCUS THE SAME FIGHT BEFORE CHASING`;
}

function ruleAgainst(style:ReturnType<typeof teamStyle>,enemies:CompositionNode[],threats:CompositionNode[],enemyDamage:CompositionNode[]){
  const threat=names(threats,'THEIR ACCESS');
  const damage=names(enemyDamage,'THEIR DAMAGE LINE');
  if(style.key==='DIVE')return`DENY ${threat} A CLEAN PATH TO THE BACK LINE; MAKE THEM CROSS PEEL / CONTROL FIRST.`;
  if(style.key==='POKE')return`ARRIVE HEALTHY AND ON TIME; DO NOT WALK THROUGH CHOKES AFTER ${damage} HAS ALREADY STARTED POKING.`;
  if(style.key==='PICK')return`MOVE IN CONNECTED GROUPS; DO NOT GIVE ${threat} AN ISOLATED TARGET BEFORE THE OBJECTIVE.`;
  if(style.key==='SIDE_PRESSURE')return`MATCH THE SIDE WAVE EARLY; DO NOT ARRIVE TO THE OBJECTIVE AFTER THEIR SIDE PRESSURE HAS ALREADY FORCED A RESPONSE.`;
  if(style.key==='FRONT_TO_BACK')return`DO NOT GIVE ${damage} A FREE STABLE 5V5; CREATE AN ANGLE, HP EDGE OR FIRST MOVE BEFORE COMMITTING.`;
  return enemies.length?'DENY ISOLATION AND KEEP THE TEAM CONNECTED THROUGH FIRST CONTACT.':'WAIT FOR THE ENEMY DRAFT TO FORM.';
}

function enemyWinCondition(input:{theirs:ReturnType<typeof teamStyle>;threatNames:string;enemyDamageNames:string;protectorNames:string;local:CompositionNode}){
  if(input.theirs.key==='DIVE')return`${input.threatNames} REACHES ${input.local.name} / YOUR DAMAGE LINE BEFORE ${input.protectorNames} CAN STABILISE THE FIGHT.`;
  if(input.theirs.key==='POKE')return`WE ENTER OBJECTIVE SPACE LATE AND LET ${input.enemyDamageNames} CREATE AN HP ADVANTAGE BEFORE FIRST CONTACT.`;
  if(input.theirs.key==='PICK')return`WE ROTATE ALONE AND GIVE ${input.threatNames} A PICK BEFORE THE 5V5 STARTS.`;
  if(input.theirs.key==='SIDE_PRESSURE')return`WE ANSWER SIDE PRESSURE LATE, SPLIT THE MAP, AND ARRIVE TO THE MAIN FIGHT IN SEPARATE GROUPS.`;
  if(input.theirs.key==='FRONT_TO_BACK')return`WE GIVE ${input.enemyDamageNames} A SLOW, STABLE FRONT-TO-BACK FIGHT WITH NO PRESSURE ON THEIR DAMAGE LINE.`;
  return`WE BREAK FORMATION, GIVE ${input.threatNames} AN ISOLATED TARGET, OR TAKE FIRST CONTACT WITHOUT FOLLOW-UP.`;
}

function lossCondition(input:{local:CompositionNode;ours:ReturnType<typeof teamStyle>;theirs:ReturnType<typeof teamStyle>;threatNames:string;protectorNames:string;damageNames:string;enemyDamageNames:string}){
  const role=input.local.role;
  if(role==='ADC')return`${input.threatNames} GETS ONTO YOU BEFORE ${input.protectorNames} CAN PEEL, OR YOU STEP OUTSIDE THAT PROTECTION BEFORE THEIR ACCESS IS COMMITTED.`;
  if(role==='JUNGLE')return`YOU START THE PLAY BEFORE YOUR LANES / ${input.protectorNames} CAN CONNECT, OR YOU ARRIVE AFTER OBJECTIVE SPACE IS ALREADY LOST.`;
  if(role==='TOP')return input.local.capabilities.SIDE>=4&&input.local.capabilities.SIDE>input.local.capabilities.FRONTLINE
    ?'YOU GROUP BEFORE SIDE PRESSURE FORCES A RESPONSE, OR STAY SIDE AFTER YOUR TEAM NEEDS YOU FOR THE MAJOR FIGHT.'
    :`YOU LEAVE ${input.damageNames} WITHOUT A FRONT EDGE WHILE ${input.threatNames} HAS ACCESS.`;
  if(role==='MID')return input.local.capabilities.PICK+input.local.capabilities.DIVE>input.local.capabilities.POKE+input.local.capabilities.CONTROL
    ?`YOU SHOW FRONT-TO-BACK INSTEAD OF CREATING AN ANGLE ON ${input.enemyDamageNames}, OR ENTER BEFORE FIRST CONTACT.`
    :`YOU LOSE MID PRIORITY AND HAVE TO WALK INTO ${input.threatNames} SECOND.`;
  if(role==='SUPPORT')return`YOU SPEND YOUR KEY ENGAGE / PEEL BEFORE ${input.threatNames} COMMITS, LEAVING ${input.damageNames} WITHOUT PROTECTION OR FOLLOW-UP.`;
  return`YOU BREAK FORMATION BEFORE ${input.threatNames} IS CONTROLLED.`;
}

function buildInteractions(input:{local:CompositionNode;firstContact:CompositionNode[];protectors:CompositionNode[];damageCore:CompositionNode[];threats:CompositionNode[];enemyDamageCore:CompositionNode[]}){
  const out:CompositionInteraction[]=[];
  const damage=input.damageCore[0]??input.local;
  const contact=input.firstContact[0];
  const protector=input.protectors[0];
  if(contact)out.push({type:'ENABLES',from:contact.name,to:damage.name,weight:scoreWeight(contact,'ENGAGE'),reason:'Creates first contact so the damage line can enter after space is established.'});
  if(protector)out.push({type:'PROTECTS',from:protector.name,to:damage.name,weight:scoreWeight(protector,'PEEL'),reason:'Provides the strongest static peel / protection signal around the main damage source.'});
  for(const threat of input.threats.slice(0,2))out.push({type:'THREATENS',from:threat.name,to:input.local.name,weight:roundScore(threatScore(threat,input.local)),reason:'Has the strongest draft-level access / pick / burst profile into your role.'});
  const enemyCarry=input.enemyDamageCore[0];
  if(enemyCarry&&contact)out.push({type:'DENIES',from:contact.name,to:enemyCarry.name,weight:scoreWeight(contact,'CONTROL'),reason:'First-contact control can stop the enemy damage core getting a free stable fight.'});
  if(input.damageCore[1])out.push({type:'FOLLOWS',from:input.damageCore[1].name,to:damage.name,weight:scoreWeight(input.damageCore[1],'DPS'),reason:'Secondary damage should enter the same fight rather than create a separate skirmish.'});
  return out.slice(0,6);
}

function threatScore(enemy:CompositionNode,local:CompositionNode){
  let score=enemy.capabilities.ENGAGE*.7+enemy.capabilities.PICK+enemy.capabilities.BURST*.7+enemy.capabilities.CONTROL*.5;
  if(local.role==='ADC'||local.capabilities.DPS>=5)score+=enemy.capabilities.DIVE*1.9+enemy.capabilities.ENGAGE+enemy.capabilities.PICK*.8;
  else if(local.capabilities.DIVE>=4||local.capabilities.PICK>=4)score+=enemy.capabilities.PEEL*1.6+enemy.capabilities.PROTECT*1.3+enemy.capabilities.CONTROL*1.2;
  else if(local.capabilities.FRONTLINE>=4)score+=enemy.capabilities.DPS*.8+enemy.capabilities.POKE*.45;
  else score+=enemy.capabilities.DIVE+enemy.capabilities.POKE*.35;
  return score;
}

function rank(team:CompositionNode[],score:(node:CompositionNode)=>number,count:number){
  return [...team].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name)).filter(node=>score(node)>0).slice(0,count);
}
function names(nodes:CompositionNode[],fallback:string){return nodes.length?nodes.map(node=>node.name).join(' / '):fallback}
function normalizeRole(value?:string|null){const role=String(value??'').trim().toUpperCase();if(role==='BOTTOM')return'ADC';if(role==='UTILITY'||role==='SUPPORT')return'SUPPORT';if(role==='MIDDLE')return'MID';return role||null}
function key(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
function same(a:string,b:string){return key(a)===key(b)}
function blankScores(){return Object.fromEntries(CAPS.map(cap=>[cap,0])) as Record<CompositionCapability,number>}
function add(scores:Record<CompositionCapability,number>,partial:Partial<Record<CompositionCapability,number>>){for(const cap of CAPS)scores[cap]+=partial[cap]??0}
function textBoost(scores:Record<CompositionCapability,number>,text:string,needles:string[],boost:Partial<Record<CompositionCapability,number>>){if(!needles.some(needle=>text.includes(needle)))return;add(scores,boost)}
function scoreWeight(node:CompositionNode,cap:CompositionCapability){return roundScore(node.capabilities[cap])}
function roundScore(value:number){return Math.round(value*10)/10}
