import type {ILPTask} from '@/lib/types';

export type PlainLanguageFocus={
  meaning:string;
  nextGame:string;
};

const has=(text:string,...needles:string[])=>needles.some(n=>text.includes(n));

export function plainLanguageFocus(task:Pick<ILPTask,'title'|'category'|'gameRule'|'why'>):PlainLanguageFocus{
  const title=String(task.title||'').toLowerCase();
  const category=String(task.category||'').toLowerCase();
  const rule=String(task.gameRule||'').toLowerCase();
  const why=String(task.why||'').toLowerCase();
  const all=[title,category,rule,why].join(' ');

  if(has(all,'preserve carry uptime','carry preservation','carry value','survival value')){
    return{
      meaning:'You are one of your team’s important damage dealers. Staying alive is usually worth more than walking into danger for one extra hit.',
      nextGame:'In fights, hit the safest target you can reach and only step forward after the enemy’s main engage or burst threat has been used.',
    };
  }
  if(has(all,'protect the advantage','protect your advantage','lead throw','protect the lead')){
    return{
      meaning:'When you are ahead, do not give the enemy an easy way back into the game by chasing risky kills or taking unnecessary fights.',
      nextGame:'Use your lead to take safe farm, towers or objectives. Make the enemy come into you instead of chasing them into danger.',
    };
  }
  if(has(all,'red-state','enemy-favoured','them stronger')){
    return{
      meaning:'Do not fight when the enemy is clearly stronger right now — for example they have more players nearby, more health, better items or levels, or a better position.',
      nextGame:'Before joining a fight, ask: “Are we actually stronger here?” If not, wait, bring another teammate, get vision, or give the fight up.',
    };
  }
  if(has(all,'spend before','bank before','banking leak','unspent gold')){
    return{
      meaning:'Gold in your pocket gives you no extra power until you buy items. Fighting while sitting on lots of gold can make you weaker than you should be.',
      nextGame:'If the fight is not forced and you can buy an important item, recall and spend your gold before choosing to fight.',
    };
  }
  if(has(all,'first threat cycle','first engage','second threat','threat cycle')){
    return{
      meaning:'The start of a teamfight is often the most dangerous moment because the enemy still has all of their engage, crowd control and burst damage available.',
      nextGame:'Survive the enemy’s first big engage. When their dangerous spells are used, move forward and deal your damage.',
    };
  }
  if(has(all,'break the second death','chain death','recovery window','recovery discipline')){
    return{
      meaning:'One death is bad; dying again straight after it makes the loss much worse because you never get time to recover gold, levels or information.',
      nextGame:'After you die, take one safe wave or camp and check the map before going back into another fight.',
    };
  }
  if(has(all,'first reset','reset discipline','protect the reset')){
    return{
      meaning:'Your first recall should turn the gold you earned in lane into items without giving the enemy a free kill or losing a huge wave.',
      nextGame:'When you have a safe chance to recall, take it. Do not stay for one extra trade or wave if it risks ruining your buy.',
    };
  }
  if(has(all,'farm vs fight','farm/fight','resource rotation','farm fight trade')){
    return{
      meaning:'Leaving guaranteed farm for a fight only makes sense when that fight can realistically win something more valuable.',
      nextGame:'Before leaving a safe wave or camp, ask what the move can actually gain. If the answer is unclear, take the guaranteed farm.',
    };
  }
  if(has(all,'objective readiness','objective setup','arrive before','setup early')){
    return{
      meaning:'Dragon, Baron and other objectives are easier to play when you arrive before the fight starts instead of walking in late.',
      nextGame:'Finish your last useful resource early enough to arrive, group and get information before the objective becomes a fight.',
    };
  }
  if(has(all,'power spike','item spike','level spike')){
    return{
      meaning:'You become temporarily stronger when you complete an important item or level. That advantage is most useful before the enemy catches up.',
      nextGame:'After a major item or level spike, look for the next safe objective, tower or pressure play instead of automatically farming another full cycle.',
    };
  }
  if(has(all,'repeat threat','threat adaptation','same enemy','access pattern')){
    return{
      meaning:'The same enemy threat is reaching you in the same way more than once. Repeating the same position or timing gives them the same opportunity again.',
      nextGame:'Name the spell or champion that keeps catching you, then change one thing next time: your distance, timing, vision or teammate proximity.',
    };
  }
  if(has(all,'positioning')){
    return{
      meaning:'This is about where you stand before and during a fight so you can contribute without being an easy target.',
      nextGame:'Keep a safe distance from the enemy’s main engage and move forward only when the dangerous threat is controlled.',
    };
  }
  if(has(all,'tempo')){
    return{
      meaning:'Tempo means doing the next useful action quickly enough that the enemy does not get time to recover or move first.',
      nextGame:'After a play ends, decide quickly: recall, take a safe resource, or move to the next objective. Avoid standing around with no clear job.',
    };
  }
  if(has(all,'trading')){
    return{
      meaning:'Trading is exchanging damage in lane. A good trade is one where you lose less health or resources than the opponent.',
      nextGame:'Only trade when your key spell is ready, the wave is safe and you still have a clear way to back out.',
    };
  }
  if(has(all,'teamfighting')){
    return{
      meaning:'This is about making better decisions once several players are fighting together — who can reach you, who you can safely hit and when to move forward.',
      nextGame:'Start safe, track the biggest enemy threat, and hit the best target you can reach without putting yourself in unnecessary danger.',
    };
  }
  if(has(all,'consistency')){
    return{
      meaning:'You can already do this well sometimes. The goal is to make the good decision happen more often and remove the avoidable bad games.',
      nextGame:'Use the same simple rule every game until it becomes automatic, even when the match feels messy.',
    };
  }

  return{
    meaning:task.why||'This is a repeated pattern OP CLIMB has seen in your games and wants you to improve one step at a time.',
    nextGame:task.gameRule||'Take one clear decision into your next game and review whether you followed it afterwards.',
  };
}
