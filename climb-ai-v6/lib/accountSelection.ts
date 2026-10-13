/**
 * Resolve the selected Riot account after a signed-in user restores their profile.
 * Server-backed selection wins over this device's stale localStorage preference.
 * Every candidate is validated against accounts actually owned by the user.
 */
export function preferredRiotAccountId(
  ownedAccountIds:readonly string[],
  cloudPreferred:string|null|undefined,
  devicePreferred:string|null|undefined,
  primaryId:string|null|undefined,
):string|null{
  const valid=new Set(ownedAccountIds);
  for(const id of [cloudPreferred,devicePreferred,primaryId]){
    if(id&&valid.has(id))return id;
  }
  return ownedAccountIds[0]??null;
}
