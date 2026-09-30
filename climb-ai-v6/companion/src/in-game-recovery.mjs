function role(value){
  const normalized=String(value||'').trim().toUpperCase();
  if(normalized==='MIDDLE')return'MID';
  if(normalized==='BOTTOM')return'ADC';
  if(normalized==='UTILITY')return'SUPPORT';
  return['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(normalized)?normalized:null;
}

export function recoveryPregameContext(snapshot){
  const players=Array.isArray(snapshot?.players)?snapshot.players:[];
  const active=snapshot?.active||{};
  const me=players.find(player=>active.riotId&&player.riotId===active.riotId)
    ||players.find(player=>active.summonerName&&player.summonerName===active.summonerName)
    ||players.find(player=>active.championName&&player.championName===active.championName&&player.team===active.team);
  if(!me?.championName||!['ORDER','CHAOS'].includes(me.team))return null;
  const allies=players.filter(player=>player.team===me.team&&player.championName);
  const enemies=players.filter(player=>player.team!==me.team&&['ORDER','CHAOS'].includes(player.team)&&player.championName);
  if(allies.length!==5||enemies.length!==5)return null;
  const pick=(player,cellId)=>({cellId,championId:0,championName:player.championName,role:role(player.position),lockedIn:true,selectionState:'LOCKED'});
  return{
    version:1,capturedAt:new Date().toISOString(),phase:'IN_GAME_RECOVERY',
    localPlayerCellId:allies.indexOf(me),localChampionId:0,localChampionName:me.championName,
    localRole:role(me.position),localLockedIn:true,localSelectionState:'LOCKED',
    allies:allies.map(pick),enemies:enemies.map(pick),bans:{allies:[],enemies:[]},
  };
}

/*
 * Game-start hand-off.
 *
 * League's client moves ChampSelect -> GameStart (loading screen) -> InProgress,
 * and its local Live Client endpoint only starts answering some time after the
 * game is running. The tracker has no session during that gap, so a heartbeat
 * derived only from its own variables said "WAITING" while a match was live:
 *
 *   - the desktop app read WAITING as "match finished" and flipped
 *     RECORDING <-> UPLOADING every half second, starting post-game review
 *     polls for a game that had not begun; and
 *   - the server only ever saw WAITING, but it will only restore a draft plan
 *     for a tracker it believes is RECORDING, so the plan could not come back.
 *
 * These are pure so the hand-off can be tested without League running.
 */

/** Gameflow phases in which a match is loading or running. */
const ACTIVE_GAMEFLOW=new Set(['GameStart','InProgress','Reconnect']);

export function isGameActivePhase(phase){
  return ACTIVE_GAMEFLOW.has(String(phase||'').trim());
}

/**
 * A gameflow reading is only trusted while it is recent. If the League client
 * closes after a match, the last phase we saw would otherwise be 'InProgress'
 * forever and the tracker would claim to be recording indefinitely.
 */
export const GAMEFLOW_FRESH_MS=10_000;

export function gameActiveNow({gameflow,gameflowSeenAt,now}){
  if(!isGameActivePhase(gameflow))return false;
  const age=Number(now)-Number(gameflowSeenAt);
  return Number.isFinite(age)&&age>=0&&age<=GAMEFLOW_FRESH_MS;
}

/**
 * The state the tracker reports to the server and the desktop app.
 *
 * Only values the server's heartbeat schema accepts are returned, and in-game
 * is reported as RECORDING rather than a new value so that an older server
 * keeps working with a newer tracker.
 */
export function trackerHeartbeatState({hasSession,gameActive,hasPregame,lcuDetected}){
  if(hasSession)return'RECORDING';
  if(gameActive)return'RECORDING';
  if(hasPregame)return'CHAMP_SELECT';
  return lcuDetected?'WAITING':'LCU_UNAVAILABLE';
}
