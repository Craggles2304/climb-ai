import type {SubscriptionTier} from './subscription';

export type GameId='league'|'tft';
export interface GameModule{
  id:GameId;
  label:string;
  home:string;
  history:string;
  coach:string;
  tier:(sharedTier:SubscriptionTier)=>SubscriptionTier;
}
export const gameModules:Record<GameId,GameModule>={
  league:{id:'league',label:'League of Legends',home:'/dashboard',history:'/matches',coach:'/coach',tier:t=>t},
  tft:{id:'tft',label:'Teamfight Tactics',home:'/tft',history:'/tft/matches',coach:'/tft/coach',tier:t=>t},
};
