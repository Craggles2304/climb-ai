/** Single account-scoped TFT development mission served to web and Companion. */
export interface TftAccountMission{
  id:string;
  status:'BASELINE'|'ACTIVE'|'MASTERED';
  domain:string;
  title:string;
  why:string;
  nextGame:string;
  success:string;
  cues:string[];
  progress:number;
  goal:number;
  evidenceCount:number;
  evidenceLabel:string;
}
