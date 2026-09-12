import type {LiveTelemetryEvent,LiveTelemetryPlayer,LiveTelemetrySnapshot} from './liveTelemetry';

export type StrengthVerdict='YOU_STRONGER'|'EVEN'|'THEM_STRONGER';
export type OpportunityType='ALL_IN_CANDIDATE'|'PRESSURE_WINDOW'|'CAUTION_WINDOW';
export type FightReviewCategory='STRENGTH'|'WEAKNESS';
export type FightOutcome='KILL'|'DEATH'|'ASSIST';

export interface StrengthPoint{
  atSeconds:number;
  verdict:StrengthVerdict;
  score:number;
  opponent:string|null;
  comparisonReason:string;
  you:{level:number;itemGold:number;dead:boolean};
  them:{level:number;itemGold:number;dead:boolean}|null;
  reasons:string[];
  confidence:'VISIBLE_STATE';
}

export interface OpportunityWindow{
  atSeconds:number;
  type:OpportunityType;
  opponent:string;
  confidence:'HIGH'|'MEDIUM';
  score:number;
  headline:string;
  detail:string;
  evidence:{
    levelDelta:number;
    itemGoldDelta:number;
    currentGold:number;
    healthPct:number|null;
    manaPct:number|null;
  };
  limitation:string;
}

export interface FightReview{
  atSeconds:number;
  category:FightReviewCategory;
  outcome:FightOutcome;
  opponent:string|null;
  opponentChampion:string|null;
  score:number;
  verdict:StrengthVerdict;
  headline:string;
  summary:string;
  evidence:{
    youLevel:number;
    themLevel:number|null;
    levelDelta:number|null;
    youItemGold:number;
    themItemGold:number|null;
    itemGoldDelta:number|null;
    currentGold:number;
    healthPct:number|null;
    manaPct:number|null;
  };
  why:string[];
  howToWin:string[];
  howYouLose:string[];
  betterDecision:string[];
  limitation:string;
}

export interface StrengthTimeline{
  points:StrengthPoint[];
  opportunities:OpportunityWindow[];
  fightReviews:FightReview[];
  strongestWindow:StrengthPoint|null;
  weakestWindow:StrengthPoint|null;
  modelNote:string;
}

const MODEL_NOTE='Visible-state power model only: level, visible item value, your current health/mana and death/respawn state. Enemy unspent gold, exact proximity and hidden cooldowns are excluded, so all-in windows are candidates rather than guaranteed kills.';
const FIGHT_LIMITATION='This is a retrospective decision review built from Riot-visible state around the event. Exact positioning, mouse inputs, ability cooldowns, fog-of-war information and enemy unspent gold are not exposed, so the coaching describes the conditions that made the fight favourable or dangerous rather than pretending to reconstruct every mechanical input.';

export function strengthPoint(snapshot:LiveTelemetrySnapshot):StrengthPoint{
  const me=findMe(snapshot);
  const opponent=chooseOpponent(snapshot,me);
  if(!me||!opponent){
    return {
      atSeconds:roundTime(snapshot.gameTime),verdict:'EVEN',score:0,opponent:null,
      comparisonReason:'No reliable opposing comparison target was available in this snapshot.',
      you:{level:me?.level??snapshot.active.level,itemGold:me?.itemGold??0,dead:me?.isDead??false},
      them:null,reasons:['Not enough visible state for a reliable strength comparison.'],confidence:'VISIBLE_STATE',
    };
  }

  const comparison=comparePlayers(me,opponent,true);
  const reasons:string[]=[];
  if(comparison.levelDelta!==0)reasons.push(`${comparison.levelDelta>0?'+':''}${comparison.levelDelta} level${Math.abs(comparison.levelDelta)===1?'':'s'}`);
  if(Math.abs(comparison.itemGoldDelta)>=150)reasons.push(`${comparison.itemGoldDelta>0?'+':''}${Math.round(comparison.itemGoldDelta)}g in visible items`);
  if(me.isDead)reasons.push(`you are dead${me.respawnTimer>0?` (${Math.ceil(me.respawnTimer)}s respawn)`:''}`);
  if(opponent.isDead)reasons.push(`${opponent.championName} is dead${opponent.respawnTimer>0?` (${Math.ceil(opponent.respawnTimer)}s respawn)`:''}`);
  if(!reasons.length)reasons.push('Levels and visible item value are very close.');

  return {
    atSeconds:roundTime(snapshot.gameTime),verdict:comparison.verdict,score:comparison.score,opponent:opponent.championName,
    comparisonReason:comparisonReason(snapshot,opponent),
    you:{level:me.level,itemGold:me.itemGold,dead:me.isDead},
    them:{level:opponent.level,itemGold:opponent.itemGold,dead:opponent.isDead},
    reasons,confidence:'VISIBLE_STATE',
  };
}

export function buildStrengthTimeline(snapshots:LiveTelemetrySnapshot[]):StrengthTimeline{
  const ordered=[...snapshots].sort((a,b)=>a.gameTime-b.gameTime);
  const raw=ordered.map(strengthPoint);
  const points:StrengthPoint[]=[];
  let previous:StrengthPoint|null=null;
  for(const point of raw){
    const meaningful=!previous
      ||point.verdict!==previous.verdict
      ||Math.abs(point.score-previous.score)>=12
      ||point.you.level!==previous.you.level
      ||point.them?.level!==previous.them?.level
      ||Math.abs(point.you.itemGold-previous.you.itemGold)>=700
      ||Math.abs((point.them?.itemGold??0)-(previous.them?.itemGold??0))>=700
      ||point.you.dead!==previous.you.dead
      ||point.them?.dead!==previous.them?.dead;
    if(meaningful){points.push(point);previous=point}
  }
  const comparable=raw.filter(point=>point.them!==null);
  const strongestWindow=comparable.length?comparable.reduce((a,b)=>b.score>a.score?b:a):null;
  const weakestWindow=comparable.length?comparable.reduce((a,b)=>b.score<a.score?b:a):null;
  const opportunities=buildOpportunities(ordered,raw);
  const fightReviews=buildFightReviews(ordered);
  return {points,opportunities,fightReviews,strongestWindow,weakestWindow,modelNote:MODEL_NOTE};
}

function buildFightReviews(snapshots:LiveTelemetrySnapshot[]):FightReview[]{
  const events=uniqueChampionKillEvents(snapshots);
  const reviews:FightReview[]=[];
  for(const event of events){
    const context=findContextSnapshot(snapshots,event.time);
    if(!context)continue;
    const me=findMe(context);
    if(!me)continue;
    const assisters=eventAssisters(event);
    const killedByMe=nameMatchesMe(event.actor,context);
    const IWasKilled=nameMatchesMe(event.target,context);
    const IAssisted=assisters.some(name=>nameMatchesMe(name,context));
    if(!killedByMe&&!IWasKilled&&!IAssisted)continue;

    const outcome:FightOutcome=IWasKilled?'DEATH':killedByMe?'KILL':'ASSIST';
    const category:FightReviewCategory=outcome==='DEATH'?'WEAKNESS':'STRENGTH';
    const opponentName=outcome==='DEATH'?event.actor:event.target;
    const opponent=findPlayerByEventName(context,opponentName);
    const comparison=opponent?comparePlayers(me,opponent,false):null;
    const healthPct=ratio(context.active.stats.currentHealth,context.active.stats.maxHealth);
    const manaPct=ratio(context.active.stats.currentMana,context.active.stats.maxMana);
    const levelDelta=opponent?me.level-opponent.level:null;
    const itemGoldDelta=opponent?me.itemGold-opponent.itemGold:null;
    const verdict=comparison?.verdict??'EVEN';
    const score=comparison?.score??0;
    const visibleEdge=describeSpecificState(levelDelta,itemGoldDelta,healthPct,manaPct);
    const opponentLabel=opponent?.championName||opponentName||'the enemy';

    const why=buildWhy(outcome,verdict,visibleEdge,context,me,opponent,assisters);
    const howToWin=buildHowToWin(outcome,verdict,context,me,opponent,healthPct,manaPct);
    const howYouLose=buildHowYouLose(outcome,verdict,context,me,opponent,healthPct,manaPct);
    const betterDecision=buildBetterDecision(outcome,verdict,context,me,opponent);
    const headline=outcome==='DEATH'
      ?`Death vs ${opponentLabel}`
      :outcome==='KILL'
        ?`Kill on ${opponentLabel}`
        :`Assist on ${opponentLabel}`;
    const summary=outcome==='DEATH'
      ?verdict==='YOU_STRONGER'
        ?`You died from a visibly stronger state. This is a high-value review point because the advantage existed but was not converted safely.`
        :verdict==='THEM_STRONGER'
          ?`You died while the opponent already held the stronger visible combat state. The main lesson is fight selection before mechanics.`
          :`You died from a roughly even visible state. Small positioning, numbers or cooldown differences that Riot does not expose likely decided the exchange.`
      :verdict==='THEM_STRONGER'
        ?`You converted a fight despite a visible power deficit. That is a genuine strength, but it should not automatically be treated as a repeatable clean 1v1.`
        :verdict==='YOU_STRONGER'
          ?`You converted the visible advantage into a positive fight result. This is the type of state OP CLIMB wants you to recognise and repeat.`
          :`You converted an approximately even visible state. The result likely came from execution, numbers or positioning rather than a large raw-stat edge.`;

    reviews.push({
      atSeconds:roundTime(event.time),category,outcome,opponent:opponentName??null,opponentChampion:opponent?.championName??null,
      score,verdict,headline,summary,
      evidence:{
        youLevel:me.level,themLevel:opponent?.level??null,levelDelta,
        youItemGold:me.itemGold,themItemGold:opponent?.itemGold??null,itemGoldDelta,
        currentGold:Math.round(context.active.currentGold),healthPct,manaPct,
      },
      why,howToWin,howYouLose,betterDecision,limitation:FIGHT_LIMITATION,
    });
  }
  return reviews.sort((a,b)=>a.atSeconds-b.atSeconds).slice(0,40);
}

function buildWhy(outcome:FightOutcome,verdict:StrengthVerdict,visibleEdge:string,snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer,opponent:LiveTelemetryPlayer|null,assisters:string[]){
  const lines:string[]=[];
  if(outcome==='DEATH')lines.push(`The fight ended in a death, so OP CLIMB classifies the moment as a weakness even if your raw visible state was stronger.`);
  else lines.push(`The fight produced a ${outcome==='KILL'?'kill':'positive assist'}, so OP CLIMB classifies the conversion as a strength.`);
  lines.push(`Immediately before the event, ${visibleEdge}.`);
  if(verdict==='YOU_STRONGER')lines.push('Your level/item state suggested you had the cleaner raw combat window. Losing from this state usually means the advantage was exposed to positioning, numbers, range or execution risk.');
  if(verdict==='THEM_STRONGER')lines.push('The opponent held the stronger raw visible state. Winning required some compensating factor such as numbers, setup, target access or better execution.');
  if(verdict==='EVEN')lines.push('Raw visible power was close, so the deciding factor was more likely fight setup, spacing, target selection, ally involvement or cooldown timing.');
  if(assisters.length)lines.push(`${assisters.length} assister${assisters.length===1?' was':'s were'} recorded on the kill event, so this was not necessarily an isolated duel.`);
  if(snapshot.active.currentGold>=900)lines.push(`You were carrying ${Math.round(snapshot.active.currentGold)}g unspent. That gold gave no combat stats until recalled and spent.`);
  if(me.position==='BOTTOM')lines.push('As ADC, surviving long enough to keep dealing damage matters more than being the first player to touch the fight. A mechanically winnable exchange can still be strategically poor if you expose yourself first.');
  if(opponent?.isDead&&outcome!=='DEATH')lines.push(`${opponent.championName} was confirmed dead after the exchange, so the conversion itself succeeded.`);
  return lines;
}

function buildHowToWin(outcome:FightOutcome,verdict:StrengthVerdict,snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer,opponent:LiveTelemetryPlayer|null,healthPct:number|null,manaPct:number|null){
  const lines:string[]=[];
  if(verdict==='YOU_STRONGER')lines.push('Use the visible advantage without donating access: make the enemy enter your effective range/space, then commit after they have already spent movement or engage resources where possible.');
  else if(verdict==='THEM_STRONGER')lines.push('Do not accept a clean isolated stat-check. The winning version needs another edge: ally numbers, crowd control, terrain, a damaged target, or the enemy committing key resources first.');
  else lines.push('Because raw power was close, the fight should be won through setup rather than confidence alone: cleaner spacing, first meaningful damage, ally numbers, or forcing the opponent to commit first.');
  if(me.position==='BOTTOM')lines.push('ADC win condition: play front-to-back, keep the nearest safe target hittable, preserve distance from the enemy engage angle, and only step deeper once the immediate threat to you is controlled or displaced.');
  if(healthPct!==null&&healthPct<0.6)lines.push(`You entered the recorded context at roughly ${Math.round(healthPct*100)}% HP. The winning line is shorter and more selective: take guaranteed damage windows, not an extended trade that lets the opponent use the health advantage.`);
  if(manaPct!==null&&manaPct<0.3)lines.push(`You had roughly ${Math.round(manaPct*100)}% resource remaining. Avoid a plan that requires multiple rotations; either finish quickly with available tools or disengage.`);
  if(snapshot.active.currentGold>=900)lines.push(`A stronger next-fight setup would be to spend the ${Math.round(snapshot.active.currentGold)}g you were holding before voluntarily taking another even contest.`);
  if(opponent)lines.push(`Against ${opponent.championName}, the repeatable objective is not simply “fight because ahead”; it is “fight while preserving the conditions that created the visible advantage.”`);
  return lines;
}

function buildHowYouLose(outcome:FightOutcome,verdict:StrengthVerdict,snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer,opponent:LiveTelemetryPlayer|null,healthPct:number|null,manaPct:number|null){
  const lines:string[]=[];
  if(verdict==='YOU_STRONGER')lines.push('The main way to throw this state is to turn a controlled advantage into an uncontrolled chase or isolated duel where the opponent gets first access to you.');
  else if(verdict==='THEM_STRONGER')lines.push('The default losing line is accepting the fight on equal numbers while already behind in visible combat value. Mechanics then have to overcome a disadvantage that did not need to be taken.');
  else lines.push('In an even state, entering first or hitting the wrong target can be enough to make the fight losing because there is no large stat cushion to absorb the mistake.');
  if(me.position==='BOTTOM')lines.push('For an ADC, stepping past your frontline/peel or chasing a low target through enemy threat range can turn a winning teamfight into your death even when your damage output is high.');
  if(healthPct!==null&&healthPct<0.5)lines.push('Low starting HP removes your margin for error; one enemy rotation or unexpected source of damage can end the fight before you realise your DPS advantage.');
  if(manaPct!==null&&manaPct<0.25)lines.push('Low resource means the fight becomes increasingly dependent on autos/basic damage and can collapse if it lasts longer than expected.');
  if(snapshot.active.currentGold>=1200)lines.push('Holding a large amount of unspent gold creates a hidden self-imposed deficit: the scoreboard may look ahead while your actual purchased combat stats lag behind what they could be.');
  if(opponent&&opponent.itemGold>me.itemGold)lines.push(`${opponent.championName} had more visible purchased item value, so giving them uninterrupted access lets their stat advantage do exactly what it is supposed to do.`);
  if(outcome==='DEATH')lines.push('Because this event ended in your death, the review should focus first on the decision that allowed enemy access, then on mechanical execution second.');
  return lines;
}

function buildBetterDecision(outcome:FightOutcome,verdict:StrengthVerdict,snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer,opponent:LiveTelemetryPlayer|null){
  const lines:string[]=[];
  if(outcome==='DEATH'&&verdict==='THEM_STRONGER')lines.push('Default decision: decline the clean fight. Give space, collect the next safe wave/camp, spend gold if needed, and only re-enter when the visible state or numbers improve.');
  else if(outcome==='DEATH'&&verdict==='YOU_STRONGER')lines.push('Default decision: keep the advantage but lower the risk. Do not be the first exposed target; force the enemy to cross space or commit to someone else, then use your stronger state as the second action.');
  else if(outcome==='DEATH')lines.push('Default decision: treat an even fight as optional. Wait for a clearer trigger—ally numbers, enemy misposition, health advantage, or a key enemy commitment—before turning it into an all-in.');
  else if(verdict==='THEM_STRONGER')lines.push('Repeat the successful setup, not the raw fight. If the same ally/numbers/CC advantage is missing next time, do not assume the previous kill proves the isolated matchup is favourable.');
  else if(verdict==='YOU_STRONGER')lines.push('This is a repeatable green-light state provided the positioning remains safe: preserve your range, convert the advantage, then reset rather than immediately forcing a second lower-quality fight.');
  else lines.push('Take the positive result, but look for a clearer edge next time. Even-state wins are useful evidence of execution, not permission to coin-flip the same fight repeatedly.');
  if(snapshot.active.currentGold>=1000)lines.push(`Before the next voluntary contest, strongly consider converting the ${Math.round(snapshot.active.currentGold)}g in pocket into purchased stats.`);
  if(me.position==='BOTTOM')lines.push('ADC rule: if you can hit safely, keep hitting the nearest safe target; if you must walk through uncontrolled enemy threat to reach the “best” target, that target is not actually available yet.');
  if(opponent)lines.push(`The next review question versus ${opponent.championName}: “What has to be true before I give them direct access to me?”`);
  return lines;
}

function buildOpportunities(snapshots:LiveTelemetrySnapshot[],points:StrengthPoint[]):OpportunityWindow[]{
  const windows:OpportunityWindow[]=[];
  let lastKey='';
  let lastAt=-999;
  for(let i=0;i<snapshots.length;i++){
    const snapshot=snapshots[i];
    const point=points[i];
    if(!point?.them||!point.opponent||point.you.dead||point.them.dead)continue;
    if(point.score>-12&&point.score<12)continue;
    const me=findMe(snapshot);
    const opponent=chooseOpponent(snapshot,me);
    if(!me||!opponent)continue;
    const levelDelta=me.level-opponent.level;
    const itemGoldDelta=me.itemGold-opponent.itemGold;
    const healthPct=ratio(snapshot.active.stats.currentHealth,snapshot.active.stats.maxHealth);
    const manaPct=ratio(snapshot.active.stats.currentMana,snapshot.active.stats.maxMana);
    const healthy=healthPct===null||healthPct>=0.6;
    const resourced=manaPct===null||manaPct>=0.3;
    const type:OpportunityType=point.score<=-12?'CAUTION_WINDOW':point.score>=24&&healthy&&resourced?'ALL_IN_CANDIDATE':'PRESSURE_WINDOW';
    const confidence:'HIGH'|'MEDIUM'=Math.abs(point.score)>=24&&healthy&&resourced?'HIGH':'MEDIUM';
    const key=`${type}:${point.opponent}`;
    if(key===lastKey&&point.atSeconds-lastAt<45)continue;
    lastKey=key;lastAt=point.atSeconds;
    const advantage=describeDelta(levelDelta,itemGoldDelta);
    const headline=type==='CAUTION_WINDOW'
      ?`Enemy-favoured window vs ${point.opponent}`
      :type==='ALL_IN_CANDIDATE'
        ?`Possible all-in window vs ${point.opponent}`
        :`Power advantage vs ${point.opponent}`;
    const detail=type==='CAUTION_WINDOW'
      ?`${point.opponent} held the stronger visible state (${advantage}). This was a poor default fight unless another advantage changed the situation.`
      :`${advantage}. If ${point.opponent} was in a reachable fight, this was a ${type==='ALL_IN_CANDIDATE'?'strong all-in candidate':'good pressure window'}.`;
    windows.push({
      atSeconds:point.atSeconds,type,opponent:point.opponent,confidence,score:point.score,headline,detail,
      evidence:{levelDelta,itemGoldDelta,currentGold:Math.round(snapshot.active.currentGold),healthPct,manaPct},
      limitation:'Riot Live Client Data does not expose enemy pocket gold, exact champion proximity or hidden cooldowns. This identifies a power window, not a guaranteed kill.',
    });
  }
  return windows.slice(0,16);
}

function uniqueChampionKillEvents(snapshots:LiveTelemetrySnapshot[]){
  const seen=new Set<string>();
  const result:LiveTelemetryEvent[]=[];
  for(const snapshot of snapshots){
    for(const event of snapshot.events){
      if(event.name!=='ChampionKill')continue;
      const key=event.id!==null?`id:${event.id}`:`${roundTime(event.time)}:${event.actor||''}:${event.target||''}`;
      if(seen.has(key))continue;
      seen.add(key);result.push(event);
    }
  }
  return result.sort((a,b)=>a.time-b.time);
}

function findContextSnapshot(snapshots:LiveTelemetrySnapshot[],eventTime:number){
  let before:LiveTelemetrySnapshot|null=null;
  for(const snapshot of snapshots){
    if(snapshot.gameTime<=eventTime-0.5)before=snapshot;
    else break;
  }
  if(before&&eventTime-before.gameTime<=15)return before;
  return snapshots.reduce<LiveTelemetrySnapshot|null>((best,current)=>{
    if(!best)return current;
    return Math.abs(current.gameTime-eventTime)<Math.abs(best.gameTime-eventTime)?current:best;
  },null);
}

function eventAssisters(event:LiveTelemetryEvent){
  const raw=event.raw?.Assisters;
  return Array.isArray(raw)?raw.filter((value):value is string=>typeof value==='string'):[];
}

function nameMatchesMe(value:string|null,snapshot:LiveTelemetrySnapshot){
  if(!value)return false;
  const candidates=[snapshot.active.summonerName,snapshot.active.riotId].filter(Boolean) as string[];
  const normalized=normalizeName(value);
  return candidates.some(candidate=>normalizeName(candidate)===normalized);
}

function findPlayerByEventName(snapshot:LiveTelemetrySnapshot,name:string|null){
  if(!name)return null;
  const normalized=normalizeName(name);
  return snapshot.players.find(player=>normalizeName(player.summonerName)===normalized||Boolean(player.riotId&&normalizeName(player.riotId)===normalized))??null;
}

function normalizeName(value:string){
  return value.trim().toLowerCase().split('#')[0].replace(/\s+/g,' ');
}

function comparePlayers(me:LiveTelemetryPlayer,opponent:LiveTelemetryPlayer,includeDeathSwing:boolean){
  const levelDelta=me.level-opponent.level;
  const itemGoldDelta=me.itemGold-opponent.itemGold;
  const deathSwing=includeDeathSwing?((me.isDead?-40:0)+(opponent.isDead?40:0)):0;
  const score=round(clamp(levelDelta*12+itemGoldDelta/125+deathSwing,-100,100));
  const verdict:StrengthVerdict=score>=8?'YOU_STRONGER':score<=-8?'THEM_STRONGER':'EVEN';
  return {levelDelta,itemGoldDelta,score,verdict};
}

function describeSpecificState(levelDelta:number|null,itemGoldDelta:number|null,healthPct:number|null,manaPct:number|null){
  const pieces:string[]=[];
  if(levelDelta!==null)pieces.push(levelDelta===0?'you were the same level':`you were ${Math.abs(levelDelta)} level${Math.abs(levelDelta)===1?'':'s'} ${levelDelta>0?'ahead':'behind'}`);
  if(itemGoldDelta!==null&&Math.abs(itemGoldDelta)>=100)pieces.push(`your visible purchased item value was ${Math.abs(Math.round(itemGoldDelta))}g ${itemGoldDelta>0?'higher':'lower'}`);
  if(healthPct!==null)pieces.push(`you had about ${Math.round(healthPct*100)}% HP`);
  if(manaPct!==null)pieces.push(`about ${Math.round(manaPct*100)}% resource`);
  return pieces.length?pieces.join(', '):'the visible combat state was approximately even';
}

function describeDelta(levelDelta:number,itemGoldDelta:number){
  const pieces:string[]=[];
  if(levelDelta)pieces.push(`${levelDelta>0?'+':''}${levelDelta} level${Math.abs(levelDelta)===1?'':'s'}`);
  if(Math.abs(itemGoldDelta)>=100)pieces.push(`${itemGoldDelta>0?'+':''}${Math.round(itemGoldDelta)}g visible item value`);
  return pieces.length?pieces.join(' and '):'visible combat state was close';
}

function findMe(snapshot:LiveTelemetrySnapshot):LiveTelemetryPlayer|null{
  const riotId=snapshot.active.riotId;
  const summoner=snapshot.active.summonerName;
  return snapshot.players.find(player=>Boolean(riotId&&player.riotId===riotId))
    ??snapshot.players.find(player=>Boolean(summoner&&player.summonerName===summoner))
    ??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)
    ??null;
}

function chooseOpponent(snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer|null):LiveTelemetryPlayer|null{
  if(!me)return null;
  const enemies=snapshot.players.filter(player=>player.team!==me.team&&player.team!=='UNKNOWN');
  if(!enemies.length)return null;
  if(me.position){
    const same=enemies.find(player=>player.position&&player.position.toUpperCase()===me.position!.toUpperCase());
    if(same)return same;
  }
  return enemies.reduce((best,current)=>{
    const currentGap=Math.abs(current.level-me.level)*1000+Math.abs(current.itemGold-me.itemGold);
    const bestGap=Math.abs(best.level-me.level)*1000+Math.abs(best.itemGold-me.itemGold);
    return currentGap<bestGap?current:best;
  });
}

function comparisonReason(snapshot:LiveTelemetrySnapshot,opponent:LiveTelemetryPlayer):string{
  const me=findMe(snapshot);
  if(me?.position&&opponent.position&&me.position.toUpperCase()===opponent.position.toUpperCase())
    return `Matched by Riot-exposed position: ${me.position}.`;
  return 'No exact lane match was exposed, so OVERPOWERED used the closest visible enemy state and labels this comparison accordingly.';
}

function ratio(value:number|null,max:number|null){
  if(value===null||max===null||max<=0)return null;
  return round(clamp(value/max,0,1));
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*10)/10;
const roundTime=(n:number)=>Math.round(Math.max(0,n)*10)/10;
