import {RiotMatchDto,RiotTimelineDto,RiotTimelineEvent} from './riotTypes';

/**
 * Key moments — "here is where this game turned, and what it cost you".
 *
 * This is the one thing a stats site structurally will not do. OP.GG shows a
 * graph; this points at 22:14 and says the death there handed the enemy Baron
 * thirty-seven seconds later.
 *
 * Everything is read from timeline events. Nothing is inferred beyond the
 * explicit window rule below, and every moment carries its own timestamp so a
 * player can go and watch it.
 */

/** A death is treated as having cost an objective if one falls within this. */
export const CONSEQUENCE_WINDOW_MS=45_000;

/** Repeats of the same objective inside this window fold into one moment. */
export const OBJECTIVE_GROUP_MS=60_000;

export type MomentType='DEATH'|'OBJECTIVE_LOST'|'OBJECTIVE_TAKEN'|'TOWER_LOST'|'ITEM';
export type Severity='LOW'|'MEDIUM'|'HIGH';

export interface KeyMoment{
  atMs:number;
  clock:string;
  type:MomentType;
  text:string;
  /** What followed, when this moment is linked to a consequence. */
  cost?:string;
  severity:Severity;
  /** Set on grouped objectives so repeats can fold together. */
  groupKey?:string;
  /** How many of the same objective this moment represents. */
  count?:number;
}

const clock=(ms:number)=>{
  const s=Math.max(0,Math.floor(ms/1000));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
};

const MONSTER_NAMES:Record<string,string>={
  BARON_NASHOR:'Baron',RIFTHERALD:'Herald',DRAGON:'a dragon',
  ELDER_DRAGON:'Elder Dragon',HORDE:'Voidgrubs',ATAKHAN:'Atakhan',
};

const monsterName=(e:RiotTimelineEvent)=>{
  if(e.monsterType==='DRAGON'&&e.monsterSubType){
    const sub=e.monsterSubType.replace('_DRAGON','').toLowerCase();
    return `${sub} dragon`;
  }
  return MONSTER_NAMES[e.monsterType??'']??'an objective';
};

function allEvents(timeline:RiotTimelineDto):RiotTimelineEvent[]{
  const out:RiotTimelineEvent[]=[];
  for(const f of timeline.info.frames)if(f.events)out.push(...f.events);
  return out.sort((a,b)=>a.timestamp-b.timestamp);
}

export function keyMoments(
  dto:RiotMatchDto,timeline:RiotTimelineDto,puuid:string,
):KeyMoment[]{
  const me=dto.info.participants.find(p=>p.puuid===puuid);
  if(!me)throw new Error(`Participant ${puuid} is not in match ${dto.metadata.matchId}.`);

  const myId=me.participantId;
  const myTeam=me.teamId;
  const events=allEvents(timeline);
  const moments:KeyMoment[]=[];

  // Objectives the enemy took, used to attribute a cost to a death.
  const enemyObjectives=events.filter(e=>
    e.type==='ELITE_MONSTER_KILL'&&teamOf(e,dto)!==null&&teamOf(e,dto)!==myTeam);

  for(const e of events){
    if(e.type==='CHAMPION_KILL'&&e.victimId===myId){
      // Did the enemy convert this death into an objective shortly after?
      const followed=enemyObjectives.find(o=>
        o.timestamp>e.timestamp&&o.timestamp-e.timestamp<=CONSEQUENCE_WINDOW_MS);
      const solo=(e.assistingParticipantIds?.length||0)===0;

      moments.push({
        atMs:e.timestamp,clock:clock(e.timestamp),type:'DEATH',
        text:solo?'You died with no one else involved — a 1v1 you lost or a pick.'
          :`You died to ${1+(e.assistingParticipantIds?.length||0)} of them.`,
        cost:followed
          ?`${capitalise(monsterName(followed))} went to the enemy ${Math.round((followed.timestamp-e.timestamp)/1000)}s later.`
          :undefined,
        severity:followed?'HIGH':e.timestamp>=1_200_000?'MEDIUM':'LOW',
      });
      continue;
    }

    if(e.type==='ELITE_MONSTER_KILL'){
      const team=teamOf(e,dto);
      if(team===null)continue;
      const mine=team===myTeam;
      const involved=e.killerId===myId||(e.assistingParticipantIds||[]).includes(myId);

      // Voidgrubs are three separate kills seconds apart. Reported one by one
      // they drown out everything else, so a repeat of the same objective by
      // the same team inside a minute folds into the moment before it.
      const previous=moments[moments.length-1];
      if(previous&&previous.groupKey===groupKey(e,team)
        &&e.timestamp-previous.atMs<=OBJECTIVE_GROUP_MS){
        previous.count=(previous.count??1)+1;
        previous.text=mine
          ?`Your team took ${previous.count}× ${monsterName(e)}${involved?' — you were there.':', without you.'}`
          :`Enemy took ${previous.count}× ${monsterName(e)}.`;
        continue;
      }

      moments.push({
        atMs:e.timestamp,clock:clock(e.timestamp),
        type:mine?'OBJECTIVE_TAKEN':'OBJECTIVE_LOST',
        text:mine
          ?`Your team took ${monsterName(e)}${involved?' — you were there.':', without you.'}`
          :`Enemy took ${monsterName(e)}.`,
        // An objective the enemy took while you were elsewhere is context, not
        // something you can act on. Your own death that caused one is.
        severity:'LOW',
        groupKey:groupKey(e,team),
        count:1,
      });
      continue;
    }

    // BUILDING_KILL.teamId is the team that OWNED the building, so a kill on
    // our team's building is a tower we lost.
    if(e.type==='BUILDING_KILL'&&e.teamId===myTeam){
      moments.push({
        atMs:e.timestamp,clock:clock(e.timestamp),type:'TOWER_LOST',
        text:`You lost a ${(e.towerType??'tower').toLowerCase().replace(/_/g,' ')}${e.laneType?` ${laneName(e.laneType)}`:''}.`,
        severity:'LOW',
      });
    }
  }

  return moments.sort((a,b)=>a.atMs-b.atMs);
}

/** The moments actually worth showing: the costly ones, newest first. */
export function turningPoints(moments:KeyMoment[],limit=4):KeyMoment[]{
  const rank={HIGH:0,MEDIUM:1,LOW:2} as const;
  return [...moments]
    .filter(m=>m.severity!=='LOW')
    .sort((a,b)=>rank[a.severity]-rank[b.severity]||a.atMs-b.atMs)
    .slice(0,limit);
}

function teamOf(e:RiotTimelineEvent,dto:RiotMatchDto):number|null{
  if(typeof e.killerTeamId==='number')return e.killerTeamId;
  const killer=dto.info.participants.find(p=>p.participantId===e.killerId);
  return killer?killer.teamId:null;
}

const laneName=(lane:string)=>
  lane==='TOP_LANE'?'top':lane==='MID_LANE'?'mid':lane==='BOT_LANE'?'bot':lane.toLowerCase();

const groupKey=(e:RiotTimelineEvent,team:number)=>
  `${team}:${e.monsterType??'?'}:${e.monsterSubType??''}`;

const capitalise=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
