import type {ILPTask} from '@/lib/types';

export type PlainLanguageFocus={
  name:string;
  meaning:string;
  nextGame:string;
  success:string;
  why:string;
};

const has=(text:string,...needles:string[])=>needles.some(n=>text.includes(n));

export function plainLanguageFocus(task:Pick<ILPTask,'title'|'category'|'gameRule'|'why'|'metric'|'target'>):PlainLanguageFocus{
  const title=String(task.title||'').toLowerCase();
  const category=String(task.category||'').toLowerCase();
  const rule=String(task.gameRule||'').toLowerCase();
  const why=String(task.why||'').toLowerCase();
  const metric=String(task.metric||'').toLowerCase();
  const all=[title,category,rule,why,metric].join(' ');

  if(has(all,'first threat cycle','first engage','second threat','threat cycle','carry preservation','preserve carry uptime')){
    return{
      name:'SURVIVE THE BURST',
      meaning:'Stay safe while the enemy still has their biggest engage and burst available.',
      nextGame:'At the start of a fight, stay just out of danger. Move forward after their main engage or burst has been used.',
      success:plainTarget(task,'Finish 3 relevant games without repeatedly dying after 20 minutes.'),
      why:'If you survive the dangerous first few seconds, you get more time to deal damage.',
    };
  }
  if(has(all,'objective_wave','objective readiness','objective setup','arrive before','setup early','final wave')){
    return{
      name:'BEAT THE CLOCK',
      meaning:'Stop getting caught between one more wave and arriving late to Dragon or Baron.',
      nextGame:'About 90 seconds before Dragon or Baron, decide now: take one last wave or move. Do not hesitate until the fight has already started.',
      success:plainTarget(task,'Make the right final-wave decision before 3 reviewed objective setups.'),
      why:'Being early gives you time to group, spend, get vision and choose a better position.',
    };
  }
  if(has(all,'lane economy','lanecspermin','leave lane at','lane farm')){
    return{
      name:'OWN THE WAVE',
      meaning:'Keep your lane farm high enough that your items arrive on time even when you are not getting kills.',
      nextGame:'Protect the big waves. Do not lose a full wave just to take a low-value trade or chase.',
      success:plainTarget(task,'Average at least 6.5 lane CS per minute across 3 games.'),
      why:'Reliable farm gives you reliable gold, levels and item timings.',
    };
  }
  if(has(all,'post_lane_farm','post15cspermin','keep collecting after lane','post-lane')){
    return{
      name:'KEEP THE GOLD FLOWING',
      meaning:'Do not stop farming just because the lane phase has ended.',
      nextGame:'After 15 minutes, check the next objective first, then collect the safest nearby wave before grouping.',
      success:plainTarget(task,'Average at least 6 CS per minute after 15 minutes across 3 relevant games.'),
      why:'Missing safe waves after lane quietly delays the items you need for later fights.',
    };
  }
  if(has(all,'second item','seconditemminute','item timing','protect your second-item')){
    return{
      name:'HIT YOUR SPIKE',
      meaning:'Get your second full item on time instead of losing gold through awkward recalls and missed waves.',
      nextGame:'Before recalling, know what you are buying and which wave you can safely collect next.',
      success:plainTarget(task,'Complete your second item by 23:00 in 3 relevant games.'),
      why:'Your second item is a major power jump. Reaching it late makes every fight harder than it needs to be.',
    };
  }
  if(has(all,'damage conversion','damageshare','useful damage','damage share')){
    return{
      name:'STAY ALIVE. THEN FIRE.',
      meaning:'Surviving a fight only matters if you use that safety to keep dealing damage.',
      nextGame:'Wait out the first big threat, then step forward with your team and keep hitting the safest target you can reach.',
      success:plainTarget(task,'Reach at least 25% of your team’s champion damage in 3 relevant games.'),
      why:'Good positioning should turn into more time attacking, not just fewer deaths.',
    };
  }
  if(has(all,'protect the advantage','protect your advantage','lead throw','protect the lead')){
    return{
      name:'DON’T THROW THE LEAD',
      meaning:'When you are ahead, stop giving the enemy free ways back into the game.',
      nextGame:'Take safe farm, towers and objectives. Do not chase risky kills when you can make the enemy walk into you.',
      success:plainTarget(task,'Show the same safe lead-management decision across 3 reviewed games.'),
      why:'A lead is valuable because it makes the next play easier — not because it gives you permission to force everything.',
    };
  }
  if(has(all,'red-state','enemy-favoured','them stronger')){
    return{
      name:'DON’T TAKE THE BAD FIGHT',
      meaning:'Stop fighting when the enemy is clearly stronger in that moment.',
      nextGame:'Before committing, ask: “Are we actually stronger here?” If not, wait, bring help or give the fight up.',
      success:plainTarget(task,'Avoid the same enemy-favoured fight mistake across 3 reviewed games.'),
      why:'Walking away from a bad fight protects gold, time and the next objective.',
    };
  }
  if(has(all,'spend before','bank before','banking leak','unspent gold')){
    return{
      name:'SPEND BEFORE YOU FIGHT',
      meaning:'Gold in your pocket does not make you stronger until you buy something.',
      nextGame:'If a fight is not forced and you can complete an important buy, recall and spend before fighting.',
      success:plainTarget(task,'Show good spend-before-fight decisions across 3 reviewed games.'),
      why:'Buying first turns the gold you already earned into actual combat power.',
    };
  }
  if(has(all,'break the second death','chain death','recovery window','recovery discipline')){
    return{
      name:'BREAK THE DEATH CHAIN',
      meaning:'After dying once, stop the game from turning that mistake into a second death straight away.',
      nextGame:'After you respawn, take one safe resource and check the map before forcing your way back into action.',
      success:plainTarget(task,'Avoid repeat deaths during the recovery window across 3 reviewed games.'),
      why:'One death costs you something. Two deaths in a row often remove any chance to recover.',
    };
  }
  if(has(all,'first reset','reset discipline','protect the reset')){
    return{
      name:'TAKE THE GOOD RESET',
      meaning:'Recall when you have a safe window instead of staying too long and ruining your buy.',
      nextGame:'When the wave is safe and you can buy something useful, recall. Do not stay for “just one more” trade or wave.',
      success:plainTarget(task,'Make the good first-reset decision across 3 reviewed games.'),
      why:'A clean recall turns your lane gold into items without donating a wave or death.',
    };
  }
  if(has(all,'farm vs fight','farm/fight','resource rotation','farm fight trade')){
    return{
      name:'DON’T LEAVE FREE GOLD',
      meaning:'Do not give up guaranteed farm for a fight that probably achieves nothing.',
      nextGame:'Before leaving a safe wave or camp, ask what the move can realistically win. If there is no clear answer, take the farm.',
      success:plainTarget(task,'Make the right farm-or-fight choice across 3 reviewed games.'),
      why:'Guaranteed gold is often worth more than arriving late to a low-chance play.',
    };
  }
  if(has(all,'power spike','item spike','level spike')){
    return{
      name:'USE YOUR POWER WINDOW',
      meaning:'When you complete an important item or level, use the temporary advantage before the enemy catches up.',
      nextGame:'After a big item or level spike, look for the next safe objective, tower or pressure play before defaulting back to farming.',
      success:plainTarget(task,'Use your power spike well across 3 reviewed games.'),
      why:'A power spike only matters if you turn it into pressure while you are stronger.',
    };
  }
  if(has(all,'repeat threat','threat adaptation','same enemy','access pattern')){
    return{
      name:'DON’T GET CAUGHT TWICE',
      meaning:'If the same champion or spell catches you once, change how you play the next time.',
      nextGame:'Name what caught you, then change one thing: your distance, timing, vision or who you stand near.',
      success:plainTarget(task,'Adapt successfully to the repeated threat across 3 reviewed games.'),
      why:'Repeating the same position gives the enemy the same easy opportunity again.',
    };
  }
  if(has(all,'jungle_setup','objectiveparticipation','neutral objectives')){
    return{
      name:'BE THERE FIRST',
      meaning:'Set yourself up for Dragon or Baron before the fight starts.',
      nextGame:'Recall, spend and move to the correct side of the map before the final objective setup begins.',
      success:plainTarget(task,'Be involved in at least 70% of objectives across 3 games.'),
      why:'As jungler, arriving late can cost your team position, vision and Smite pressure.',
    };
  }
  if(has(all,'jungle_deaths','stop donating tempo','late jungle death')){
    return{
      name:'KEEP SMITE ALIVE',
      meaning:'Avoid late deaths that leave your team without a jungler for the next objective.',
      nextGame:'After 20 minutes, do not walk into dark enemy space unless you know why it is safe and what you are gaining.',
      success:plainTarget(task,'Finish 3 relevant games with 2 or fewer deaths after 20 minutes.'),
      why:'A late jungle death can hand the enemy the next Dragon or Baron for free.',
    };
  }
  if(has(all,'jungle_farm','camps converting','cspermin')){
    return{
      name:'CLEAR WITH PURPOSE',
      meaning:'Keep taking camps so you stay levelled while still moving toward the next useful play.',
      nextGame:'Between plays, clear camps in the direction of the next objective instead of crossing the map for a low-chance fight.',
      success:plainTarget(task,'Average at least 6 CS per minute across 3 relevant games.'),
      why:'Keeping up in levels makes your fights, invades and Smites stronger.',
    };
  }
  if(has(all,'support_vision','vision cycle','visionscore')){
    return{
      name:'LIGHT UP THE MAP',
      meaning:'Get useful vision down before the objective fight starts.',
      nextGame:'Reset early, place your wards, then leave the dark area before the enemy can collapse on you.',
      success:plainTarget(task,'Reach at least 40 vision score in 3 games.'),
      why:'Good vision lets your team see the fight before they have to take it.',
    };
  }
  if(has(all,'support_kp','killparticipation','plays that matter')){
    return{
      name:'BE WHERE IT MATTERS',
      meaning:'Make your roams count by moving toward real plays, not just wandering away from lane.',
      nextGame:'Before leaving lane, name the play you are moving to and what you are giving up to get there.',
      success:plainTarget(task,'Reach at least 65% kill participation across 3 games.'),
      why:'A good roam puts you where the important kills and objectives are actually happening.',
    };
  }
  if(has(all,'support_survival','vision without','becoming the pick')){
    return{
      name:'WARD. DON’T DIE.',
      meaning:'Create vision without giving the enemy a free support kill.',
      nextGame:'Do not walk into dark space unless you have a teammate, known enemy positions or a safe escape route.',
      success:plainTarget(task,'Finish 3 relevant games with 4 or fewer deaths.'),
      why:'Dying for a ward removes the map control that ward was supposed to create.',
    };
  }
  if(has(all,'map_check','mapcheck','map check','map awareness')){
    return{
      name:'EYES UP',
      meaning:'Check the minimap before you commit to something dangerous.',
      nextGame:'Before a trade, push or river move, glance at the minimap and name the closest missing enemy.',
      success:plainTarget(task,'Show consistent pre-commit map checks in 3 reviewed games.'),
      why:'Many “random” deaths actually start several seconds earlier when you commit without checking the map.',
    };
  }
  if(has(all,'general_survival','reduce avoidable deaths')||metric==='deaths'){
    return{
      name:'CUT THE FREE DEATHS',
      meaning:'Remove deaths where you had no good reason to be in danger.',
      nextGame:'Before pushing beyond the river or deep into a side lane, ask what information makes the move safe.',
      success:plainTarget(task,'Finish 3 relevant games with 4 or fewer deaths.'),
      why:'Every avoidable death costs gold, XP, waves and time on the map.',
    };
  }
  if(has(all,'positioning')){
    return{
      name:'FIND THE SAFE ANGLE',
      meaning:'Stand where you can still help without becoming the easiest target to kill.',
      nextGame:'Keep space from the enemy’s main engage and only move closer when that threat is controlled.',
      success:plainTarget(task,'Show the safer positioning decision across 3 reviewed games.'),
      why:'Good positioning gives you more useful seconds in every fight.',
    };
  }
  if(has(all,'tempo')){
    return{
      name:'MOVE FIRST',
      meaning:'Make the next useful decision quickly instead of standing around while the enemy gets there first.',
      nextGame:'When a play ends, choose quickly: recall, take a safe resource or move to the next objective.',
      success:plainTarget(task,'Make the faster useful follow-up decision across 3 reviewed games.'),
      why:'Small delays add up and often turn into late recalls, missed waves or late objective setups.',
    };
  }
  if(has(all,'trading')){
    return{
      name:'TRADE ON YOUR TERMS',
      meaning:'Only take lane trades when the setup gives you a good chance to come out ahead.',
      nextGame:'Trade when your key spell is ready, the wave is safe and you still have a clear way back out.',
      success:plainTarget(task,'Show controlled, favourable trades across 3 reviewed games.'),
      why:'A good trade should make the next wave or all-in easier, not just exchange health for no reason.',
    };
  }
  if(has(all,'consistency')){
    return{
      name:'MAKE IT YOUR NORMAL',
      meaning:'You can already do this sometimes. Now the goal is to make the good decision happen every game.',
      nextGame:'Use the same simple rule again, even when the match becomes messy.',
      success:plainTarget(task,'Repeat the good behaviour cleanly across 3 relevant games.'),
      why:'A skill is only useful when you can rely on it under pressure.',
    };
  }

  return{
    name:fallbackName(task),
    meaning:simplify(task.why)||'This is a repeated problem OP CLIMB wants you to fix one step at a time.',
    nextGame:simplify(task.gameRule)||'Take one clear decision into your next game and check afterwards whether you followed it.',
    success:plainTarget(task,'Show this behaviour cleanly in 3 relevant games.'),
    why:simplify(task.why)||'OP CLIMB has seen this pattern often enough to make it one of your two current priorities.',
  };
}

function plainTarget(task:Pick<ILPTask,'target'>,fallback:string){
  const target=String(task.target||'').trim();
  if(!target)return fallback;
  return target
    .replace(/^≤/,'No more than ')
    .replace(/^>=?/,'At least ')
    .replace(/\bpost-20\b/gi,'after 20 minutes')
    .replace(/\bCS\/min\b/gi,'CS per minute')
    .replace(/\bPRO evidence score\b/gi,'OP CLIMB decision score')
    .replace(/\bacross\b/gi,'in')
    .replace(/\brelevant games\b/gi,'games');
}

function fallbackName(task:Pick<ILPTask,'title'|'category'|'metric'>){
  const metric=String(task.metric||'').toLowerCase();
  const category=String(task.category||'').toUpperCase();
  if(metric.includes('reset')||metric.includes('gold'))return'SPEND IT WELL';
  if(metric.includes('objective'))return'BE READY EARLY';
  if(metric.includes('fight'))return'PICK THE RIGHT FIGHT';
  if(metric.includes('farm')||metric.includes('cs'))return'KEEP THE GOLD COMING';
  if(metric.includes('survival')||metric.includes('death'))return'STOP THE FREE DEATHS';
  if(metric.includes('item')||metric.includes('build'))return'HIT YOUR ITEMS';
  if(metric.includes('threat'))return'KNOW THE DANGER';
  if(category==='TEAMFIGHTING')return'FIGHT SMART';
  if(category==='TEMPO')return'MOVE FIRST';
  if(category==='MAP_AWARENESS')return'EYES UP';
  if(category==='POSITIONING')return'FIND THE SAFE ANGLE';
  const cleaned=String(task.title||'').replace(/^Improve\s+/i,'').trim();
  return cleaned?cleaned.toUpperCase():'NEXT LEVEL';
}

function simplify(value:string){
  return String(value||'')
    .replace(/\btempo\b/gi,'timing')
    .replace(/\bneutral objectives?\b/gi,'Dragon or Baron')
    .replace(/\bresource(s)?\b/gi,'farm')
    .replace(/\bthreat cycle\b/gi,'dangerous spells')
    .replace(/\bconversion\b/gi,'turning it into value')
    .replace(/\bcommit(ting|ted)?\b/gi,'go in')
    .replace(/\bpressure\b/gi,'map advantage')
    .trim();
}
