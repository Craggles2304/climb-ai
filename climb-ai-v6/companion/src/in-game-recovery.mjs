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
