import type {CoachEnginePlan} from './draftCoachEngine';
import type {DraftRole,DraftRolePlayer} from './draftRoleResolver';

export type FrozenBranchKey='AHEAD'|'EVEN'|'BEHIND';

export interface FrozenBranch{
  key:FrozenBranchKey;
  headline:string;
  rule:string;
  fight:string;
  objective:string;
  never:string;
}

export interface FrozenCheckpoint{
  minute:5|10|15;
  prompt:string;
  questions:string[];
}

export interface FrozenGamePlaybook{
  version:'FROZEN_V1';
  draftFingerprint:string;
  champion:string;
  role:DraftRole|null;
  rank:string|null;
  baseCall:string;
  baseWhy:string;
  fightRule:string;
  objectiveRule:string;
  threatRule:string;
  never:string;
  branches:Record<FrozenBranchKey,FrozenBranch>;
  checkpoints:FrozenCheckpoint[];
}

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function compact(value:string,max=180){
  const text=clean(value);
  return text.length<=max?text:text.slice(0,max-1).replace(/\s+\S*$/,'')+'…';
}
function fingerprint(players:DraftRolePlayer[]){
  return players
    .map(player=>clean(player.role).toUpperCase()+':'+clean(player.champion).toLowerCase())
    .sort()
    .join('|');
}

function roleEconomyRule(role:DraftRole|null,champion:string){
  if(role==='ADC')return `${champion}: PRESERVE FARM / HP AND DO NOT TRADE POSITION FOR A LOW-VALUE CHASE.`;
  if(role==='SUPPORT')return `${champion}: SYNC RESETS WITH YOUR CARRY AND ARRIVE TO VISION SETUP TOGETHER.`;
  if(role==='JUNGLE')return `${champion}: RESET BEFORE THE NEXT OBJECTIVE WINDOW; DO NOT ENTER RIVER WITH LOSING LANES.`;
  if(role==='MID')return `${champion}: FIX MID WAVE BEFORE MOVING; DO NOT SACRIFICE GUARANTEED TEMPO FOR A LATE ROAM.`;
  if(role==='TOP')return `${champion}: FIX THE SAFE SIDE WAVE, THEN JOIN ON THE TIMING YOUR DRAFT ACTUALLY WANTS.`;
  return `${champion}: PRESERVE THE RESOURCE / TEMPO NEEDED FOR YOUR DRAFT PLAN.`;
}

export function buildFrozenGamePlaybook(input:{
  champion:string;
  role:DraftRole|null;
  rank?:string|null;
  ours:DraftRolePlayer[];
  enemies:DraftRolePlayer[];
  plan:CoachEnginePlan;
}):FrozenGamePlaybook{
  const champion=clean(input.champion);
  const draftFingerprint='ours['+fingerprint(input.ours)+']::enemies['+fingerprint(input.enemies)+']';
  const economy=roleEconomyRule(input.role,champion);
  const baseFight=compact(input.plan.fightTrigger||input.plan.threatAnswer);
  const baseObjective=compact(input.plan.objectiveSetup);
  const baseNever=compact(input.plan.never||input.plan.lanePlan?.respect||'DO NOT BREAK THE DRAFT PLAN FOR A LOW-VALUE CHASE.');

  const ahead:FrozenBranch={
    key:'AHEAD',
    headline:'AHEAD → CONTROL, DO NOT COIN-FLIP',
    rule:compact(`${economy} USE THE LEAD TO FORCE THE ENEMY THROUGH YOUR EXISTING WIN CONDITION; DO NOT INVENT A NEW FIGHT JUST BECAUSE YOU ARE AHEAD.`),
    fight:compact(`KEEP THE SAME FIRST-CONTACT RULE: ${baseFight}`),
    objective:compact(`TURN THE LEAD INTO SETUP: ${baseObjective}`),
    never:compact(`DO NOT THROW ACCESS / POSITION FOR EXTRA KILLS. ${baseNever}`),
  };

  const even:FrozenBranch={
    key:'EVEN',
    headline:'EVEN → EXECUTE THE ORIGINAL PLAN',
    rule:compact(`${economy} THE DRAFT IS STILL PLAYABLE ON ITS ORIGINAL TERMS; MAKE THE OTHER TEAM BREAK FORMATION FIRST.`),
    fight:compact(baseFight),
    objective:compact(baseObjective),
    never:baseNever,
  };

  const behind:FrozenBranch={
    key:'BEHIND',
    headline:'BEHIND → TRADE SPACE FOR A CLEANER FIGHT',
    rule:compact(input.plan.ifBehind||`${economy} TAKE THE SAFEST RESOURCE, GROUP EARLY, AND MAKE THEM ENTER YOUR RANGE.`),
    fight:compact(`DO NOT FORCE FROM SECOND MOVE. USE THE SAME THREAT RULE: ${input.plan.threatAnswer}`),
    objective:compact(`CONCEDE SETUP YOU CANNOT HOLD; RE-ENTER ONLY THROUGH YOUR PREPLANNED GEOMETRY: ${baseObjective}`),
    never:compact(`DO NOT PAY HP / SUMMONERS TO DEFEND SPACE YOU CANNOT CONTROL. ${baseNever}`),
  };

  return{
    version:'FROZEN_V1',
    draftFingerprint,
    champion,
    role:input.role,
    rank:clean(input.rank)||null,
    baseCall:compact(input.plan.headline,120),
    baseWhy:compact(input.plan.why),
    fightRule:baseFight,
    objectiveRule:baseObjective,
    threatRule:compact(input.plan.threatAnswer),
    never:baseNever,
    branches:{AHEAD:ahead,EVEN:even,BEHIND:behind},
    checkpoints:[
      {
        minute:5,
        prompt:'5 MIN · READ THE BOARD YOURSELF',
        questions:[
          'WHICH PREBUILT BRANCH FITS: AHEAD / EVEN / BEHIND?',
          compact('IS THE LANE STILL BEING PLAYED BY THE ORIGINAL RULE? '+input.plan.lanePlan.wave,150),
          compact('ARE YOU RESPECTING THE DRAFT THREAT? '+input.plan.threatAnswer,150),
        ],
      },
      {
        minute:10,
        prompt:'10 MIN · READ THE BOARD YOURSELF',
        questions:[
          'WHICH PREBUILT BRANCH FITS NOW: AHEAD / EVEN / BEHIND?',
          compact('IS YOUR NEXT FIGHT STILL STARTING ON THE RIGHT CONDITION? '+baseFight,150),
          compact('ARE YOU RESETTING / MOVING EARLY ENOUGH FOR THE ORIGINAL OBJECTIVE PLAN? '+baseObjective,150),
        ],
      },
      {
        minute:15,
        prompt:'15 MIN · READ THE BOARD YOURSELF',
        questions:[
          'WHICH PREBUILT BRANCH FITS NOW: AHEAD / EVEN / BEHIND?',
          compact('BEFORE THE NEXT MAJOR FIGHT, CAN YOU STILL EXECUTE: '+input.plan.headline,150),
          compact('IF THE GAME IS MESSY, RETURN TO THE NEVER RULE: '+baseNever,150),
        ],
      },
    ],
  };
}

export function chooseFrozenBranch(playbook:FrozenGamePlaybook,key:FrozenBranchKey){
  return playbook.branches[key];
}
