/**
 * The one champion a player mains.
 *
 * This gates the deep champion page deliberately. Ranking 172 matchups and 133
 * items is only useful when it is about the champion someone actually plays —
 * shown for all of them at once it is a data dump, not coaching. Picking a main
 * is also the honest scope for this data: the numbers describe one champion's
 * stat line, and a player who knows that champion can judge whether the reading
 * matches what they feel in game.
 *
 * Stored per browser, like the rest of the pre-Supabase state.
 */

const KEY='op:main-champion';

/** Fired when the main changes, so open pages update without a reload. */
export const MAIN_CHAMPION_EVENT='op:main-champion-changed';

export function getMainChampion():string|null{
  if(typeof window==='undefined')return null;
  try{
    const raw=window.localStorage.getItem(KEY);
    return raw&&raw.trim()?raw:null;
  }catch{
    // Private windows and blocked site data throw rather than returning null.
    return null;
  }
}

export function setMainChampion(champion:string):void{
  if(typeof window==='undefined')return;
  const value=champion.trim();
  try{
    if(value)window.localStorage.setItem(KEY,value);
    else window.localStorage.removeItem(KEY);
  }catch{
    // Storage being unavailable must not break the picker.
  }
  window.dispatchEvent(new CustomEvent(MAIN_CHAMPION_EVENT,{detail:value}));
}

export function clearMainChampion():void{
  setMainChampion('');
}
