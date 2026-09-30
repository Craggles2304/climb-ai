const text=value=>typeof value==='string'?value.trim():'';
const int=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(fallback,Math.round(Number(value))):fallback;
const championId=pick=>int(pick?.championId)||int(pick?.selectedChampionId);
const actionLocked=action=>Boolean(action?.completed||action?.isCompleted||action?.lockedIn||action?.selectionState==='LOCKED');

function role(raw){
  const value=(text(raw?.assignedPosition)||text(raw?.position)).toUpperCase();
  if(value==='BOTTOM'||value==='ADC')return'ADC';
  if(value==='UTILITY'||value==='SUPPORT')return'SUPPORT';
  if(value==='MIDDLE'||value==='MID')return'MID';
  if(value==='TOP'||value==='JUNGLE')return value;
  return int(raw?.spell1Id)===11||int(raw?.spell2Id)===11?'JUNGLE':null;
}

export async function normalizePregame(data,resolveChampionName){
  const myTeam=Array.isArray(data?.myTeam)?data.myTeam:[];
  const theirTeam=Array.isArray(data?.theirTeam)?data.theirTeam:[];
  const actions=(Array.isArray(data?.actions)?data.actions:[]).flatMap(row=>Array.isArray(row)?row:[]);
  const picks=actions.filter(action=>text(action?.type).toLowerCase()==='pick');
  const allyBans=Array.isArray(data?.bans?.myTeamBans)?data.bans.myTeamBans:[];
  const enemyBans=Array.isArray(data?.bans?.theirTeamBans)?data.bans.theirTeamBans:[];
  const ids=[...myTeam,...theirTeam].map(championId).concat(picks.map(championId),allyBans.map(id=>int(id)),enemyBans.map(id=>int(id))).filter(id=>id>0);
  const names=new Map(await Promise.all([...new Set(ids)].map(async id=>[id,await resolveChampionName(id)])));
  const latestAction=cellId=>[...picks].reverse().find(action=>int(action?.actorCellId,-1)===cellId&&championId(action)>0)||null;
  const locked=cellId=>picks.some(action=>int(action?.actorCellId,-1)===cellId&&actionLocked(action));
  const selected=(raw,allowHover)=>{
    const direct=championId(raw);
    if(direct>0)return direct;
    const action=latestAction(int(raw?.cellId,-1));
    return action&&(actionLocked(action)||allowHover)?championId(action):0;
  };
  const pick=(raw,allowHover)=>{
    const cellId=int(raw?.cellId,-1),id=selected(raw,allowHover),isLocked=locked(cellId);
    return{cellId,championId:id,championName:names.get(id)||null,role:role(raw),lockedIn:isLocked,selectionState:isLocked?'LOCKED':id>0?'HOVER':'WAITING'};
  };
  const localCell=int(data?.localPlayerCellId,-1);
  const local=myTeam.find(raw=>int(raw?.cellId,-1)===localCell)||null;
  const localPick=local?pick(local,true):null;
  const ban=id=>({championId:int(id),championName:names.get(int(id))||null});
  return{
    version:1,capturedAt:new Date().toISOString(),phase:text(data?.timer?.phase)||text(data?.timer?.phaseType)||'CHAMP_SELECT',
    localPlayerCellId:localCell,localChampionId:localPick?.championId||0,localChampionName:localPick?.championName||null,
    localRole:localPick?.role||null,localLockedIn:localPick?.lockedIn||false,localSelectionState:localPick?.selectionState||'WAITING',
    allies:myTeam.map(raw=>pick(raw,true)).slice(0,5),enemies:theirTeam.map(raw=>pick(raw,false)).slice(0,5),
    bans:{allies:allyBans.map(ban).filter(value=>value.championId>0).slice(0,10),enemies:enemyBans.map(ban).filter(value=>value.championId>0).slice(0,10)},
  };
}
