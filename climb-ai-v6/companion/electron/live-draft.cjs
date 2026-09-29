function draftFromLocalContext(context){
  if(!context||typeof context!=='object')return null;
  const picks=values=>Array.isArray(values)?values.slice(0,5):[];
  const bans=values=>Array.isArray(values)?values.slice(0,10):[];
  return{
    capturedAt:String(context.capturedAt||''),
    phase:String(context.phase||'CHAMP_SELECT'),
    localPlayerCellId:Number(context.localPlayerCellId??-1),
    localChampionName:context.localChampionName||null,
    localRole:context.localRole||null,
    localLockedIn:Boolean(context.localLockedIn),
    localSelectionState:context.localSelectionState||'WAITING',
    allies:picks(context.allies),
    enemies:picks(context.enemies),
    bans:{allies:bans(context.bans?.allies),enemies:bans(context.bans?.enemies)},
  };
}

function freshestDraft(current,incoming){
  if(!incoming)return current||null;
  if(!current)return incoming;
  const currentAt=Date.parse(String(current.capturedAt||''));
  const incomingAt=Date.parse(String(incoming.capturedAt||''));
  if(Number.isFinite(currentAt)&&(!Number.isFinite(incomingAt)||incomingAt<currentAt))return current;
  return incoming;
}

module.exports={draftFromLocalContext,freshestDraft};
