import type {ILPTask,Role} from './types';

export interface AwarenessMission{
  id:string;
  name:string;
  meaning:string;
  cue:string;
}

export function awarenessMissions(task:Pick<ILPTask,'metric'|'category'|'title'>,role?:Role):AwarenessMission[]{
  const metric=String(task.metric||'').toLowerCase();
  const category=String(task.category||'').toUpperCase();
  const title=String(task.title||'').toLowerCase();
  const picks:AwarenessMission[]=[];

  const add=(id:string,name:string,meaning:string,cue:string)=>{
    if(!picks.some(item=>item.id===id))picks.push({id,name,meaning,cue});
  };

  if(metric==='lanecspermin'||metric==='csat10'||metric==='csat15'){
    add('eyes-up-wave','EYES UP BEFORE THE WAVE','Farm is only useful if you can collect it safely.','Before walking up for a wave, glance at the map and name the closest missing threat.');
    add('trade-cost','DON’T BUY FARM WITH HEALTH','A few minions are not worth losing the lane for.','If taking the wave means eating a full enemy combo, let the dangerous minions go.');
  }else if(metric==='post15cspermin'||metric==='cspermin'){
    add('farm-blind','DON’T FARM BLIND','Side-lane gold is valuable, but getting caught removes the value immediately.','Before taking a side wave, check the next objective and how many enemies are missing.');
    add('group-window','KNOW WHEN TO LEAVE','Sometimes the right decision is to stop farming and arrive first.','If a major objective is close, finish the safe wave and move before your team has to fight.');
  }

  if(metric==='seconditemminute'){
    add('plan-reset','PLAN THE RESET','A good recall starts before you press B.','Know what item you are buying and which wave you can afford to miss before you recall.');
    add('one-more-wave','NO “ONE MORE WAVE” GREED','Staying too long often ruins the item timing you just earned.','If your buy is ready and the wave is safe, leave instead of forcing one extra wave.');
  }

  if(metric==='deathspre10'||metric==='deaths'){
    add('name-threat','NAME THE DANGER','Most avoidable deaths have a clear champion, spell or route that makes the play unsafe.','Before walking forward, know which enemy can punish you first.');
    add('exit-route','KEEP AN EXIT','Going in is safer when you already know how you get back out.','Before a trade or push, know whether you can retreat through lane, river or a teammate.');
  }

  if(metric==='deathspost20'){
    add('track-engage','TRACK THE ENGAGE','Late fights are often decided by the first big engage or assassin cooldown.','Do not step into full damage range until the main threat is used, blocked or clearly elsewhere.');
    add('dark-space','DON’T WALK INTO DARKNESS','One late face-check can give away Baron, Dragon or the game.','If you cannot see the route, wait for vision or move with a teammate.');
  }

  if(metric==='damageshare'){
    add('safe-target','HIT WHAT YOU CAN REACH','Useful damage is better than dying while trying to reach the perfect target.','Hit the safest target in range until a better target becomes safe.');
    add('threat-first','SURVIVE FIRST, DAMAGE SECOND','Your damage window usually opens after the enemy spends their easiest way to reach you.','Watch the main engage or assassin before stepping closer.');
  }

  if(metric==='objectiveparticipation'){
    add('objective-clock','90-SECOND ALARM','Objective fights are easier when your setup starts before the spawn timer reaches zero.','Around 90 seconds before Dragon or Baron, think recall, spend, route and vision.');
    add('smite-life','KEEP SMITE ALIVE','A jungler death before an objective removes your team’s strongest secure tool.','Near a major objective, avoid dark enemy space unless the gain is worth the risk.');
  }

  if(metric==='killparticipation'){
    add('roam-purpose','ROAM WITH A REASON','Leaving your current area only makes sense if there is a real play to arrive for.','Before moving, name the kill, objective or teammate you are moving toward.');
    add('cost-of-roam','KNOW THE COST','Every roam gives something up somewhere else.','Before leaving, know which wave, camp or plate you might lose.');
  }

  if(metric==='visionscore'){
    add('ward-exit','WARD WITH AN EXIT','Vision is not worth a free death.','Place deep vision only when you know where the enemy is, have backup or have a clear escape.');
    add('vision-before','VISION BEFORE THE FIGHT','The best ward usually goes down before everyone arrives.','Reset early enough to place vision and leave the area before the enemy collapses.');
  }

  if(category==='OBJECTIVES'||title.includes('objective')){
    add('objective-clock','90-SECOND ALARM','Objective fights are easier when your setup starts before the spawn timer reaches zero.','Around 90 seconds before Dragon or Baron, think recall, spend, route and vision.');
  }
  if(category==='TEAMFIGHTING'){
    add('count-threats','COUNT THE DANGER','Your position should change depending on which enemy threats are still available.','Before the fight starts, name the one champion or spell you cannot ignore.');
  }
  if(category==='POSITIONING'){
    add('safe-angle','FIND THE SAFE ANGLE','You want a position where you can help without being the easiest target.','Stand where your frontline or terrain makes it harder for the enemy to reach you.');
  }
  if(category==='MAP_AWARENESS'){
    add('map-check','EYES UP','A quick map check can stop a bad move before it starts.','Before a trade, push or river move, glance at the minimap and count missing enemies.');
  }
  if(category==='TEMPO'){
    add('decide-early','DECIDE BEFORE YOU MOVE','Late decisions create late recalls, late rotations and bad fights.','When a play ends, choose quickly: recall, farm or move to the next objective.');
  }
  if(category==='MATCHUPS'){
    add('caught-twice','DON’T GET CAUGHT TWICE','If the same champion or spell catches you once, the next attempt should look different.','Change your distance, timing, vision or teammate position the next time.');
  }

  if(role==='SUPPORT'){
    add('support-count','COUNT BEFORE YOU WARD','Support deaths often happen because vision was placed without knowing who could collapse.','Before entering fog, count visible enemies and wait if too many are missing.');
  }
  if(role==='JUNGLE'){
    add('jungle-next-side','CLEAR TOWARD THE NEXT PLAY','Your camp route should help you arrive where the next important play will happen.','When clearing, finish on the side of the next objective or lane you can actually affect.');
  }
  if(role==='ADC'){
    add('adc-distance','KEEP YOUR DAMAGE DISTANCE','As ADC, being one step farther back is often better than being one second dead.','Let the fight start before you move into the enemy’s easiest engage range.');
  }

  if(!picks.length){
    add('map-check','EYES UP','A quick map check can stop a bad move before it starts.','Before committing to a play, glance at the minimap and count missing enemies.');
    add('decision-reason','KNOW WHY YOU’RE MOVING','Good decisions have a reason before the movement starts.','Before leaving your current position, name what you expect to gain.');
  }

  return picks.slice(0,2);
}
