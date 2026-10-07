import type {DnaDomain} from './types';
import type {DecisionGraph} from './decisionGraph';
import type {RiotMatchDto,RiotTimelineDto,RiotTimelineEvent,RiotTimelineFrame} from './riot/riotTypes';
import type {LiveTelemetrySnapshot,LiveTelemetryEvent,LiveTelemetryPlayer} from './riot/liveTelemetry';
import type {StrengthTimeline,FightReview} from './riot/liveStrength';

export type ReconstructionSide='GOOD'|'CRITICAL';
export type ReconstructionSource='MATCH_V5_TIMELINE'|'LIVE_TELEMETRY';
export type ReconstructionEvidenceKind='VERIFIED'|'CONNECTED'|'COACHING_INFERENCE';

export interface ReconstructionEvidence{
  kind:ReconstructionEvidenceKind;
  atSeconds?:number;
  label:string;
  detail:string;
}

export interface MatchReconstructionStory{
  id:string;
  side:ReconstructionSide;
  atSeconds:number;
  clock:string;
  title:string;
  behaviourLabel:string;
  dnaDomain:DnaDomain;
  before:string;
  decision:string;
  consequence:string;
  coaching:string;
  evidence:ReconstructionEvidence[];
  source:ReconstructionSource;
  confidence:'HIGH'|'MEDIUM'|'LOW';
  severity:number;
}

export interface MatchReconstruction{
  version:2;
  source:ReconstructionSource;
  generatedAt:string;
  stories:MatchReconstructionStory[];
  boundary:string;
}

const BOUNDARY='OP CLIMB reconstructs only Riot-visible or Companion-recorded state. VERIFIED means a recorded event/state. CONNECTED means recorded events are linked by time and team ownership. COACHING_INFERENCE explains why that verified sequence matters; it does not claim hidden intent, exact positioning, cooldowns, fog information or team communication.';
const clock=(seconds:number)=>{const s=Math.max(0,Math.floor(seconds));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();

export function buildRiotMatchReconstruction(dto:RiotMatchDto,timeline:RiotTimelineDto,puuid:string):MatchReconstruction|null{
  const me=dto.info.participants.find(p=>p.puuid===puuid);
  if(!me)return null;
  const events=timeline.info.frames.flatMap(frame=>frame.events??[]).sort((a,b)=>a.timestamp-b.timestamp);
  const myId=me.participantId,myTeam=me.teamId;
  const stories:MatchReconstructionStory[]=[];
  const interactions=events.filter(event=>event.type==='CHAMPION_KILL'&&(event.victimId===myId||event.killerId===myId||(event.assistingParticipantIds??[]).includes(myId)));

  for(const event of interactions){
    const seconds=event.timestamp/1000;
    const death=event.victimId===myId;
    const enemy=death?participantName(dto,event.killerId):participantName(dto,event.victimId);
    const before=stateBeforeRiot(timeline,events,myId,event.timestamp);
    const nextConversion=findConversionAfter(events,dto,myTeam,event.timestamp,death?60_000:75_000,death?'ENEMY':'ALLY');
    const currentGold=frameAt(timeline,event.timestamp)?.participantFrames[String(yId)]?.currentGold??0;
    const rank=teamGoldRank(dto,timeline,event.timestamp,me);
    const repeat=death&&event.killerId?events.filter(e=>e.type==='CHAMPION_KILL'&&e.victimId===myId&&e.killerId===event.killerId&&e.timestamp<=event.timestamp).length:0;

    let behaviour='Fight Selection';
    let domain:DnaDomain='TEAMFIGHTS';
    let title=death?`Death to ${enemy}`:Positive fight vs ${enemy}`;
    let coaching=death?'Protect your availability before the next meaningful team action.':'Repeat the setup that let you stay available and convert the fight.';
    let severity=death?55:45;

    if(nextConversion?.kind==='OBJECTIVE'){
      behaviour='Objective Readiness';domain='OBJECTIVES';severity+=25;
      title=death?`Death before ${nextConversion.name}`:`Fight converted into ${nextConversion.name}`;
      coaching=death?'Treat the objective timer as part of the fight. Staying alive before it is often more valuable than taking one extra low-percentage exchange.':'Repeat this: win or survive the fight, then immediately convert the map objective.';
    }else if(currentGold>=1200&&death){
      behaviour='Reset Discipline';domain='WAVES_CS';severity+=18;
      title=`Died with ${Math.round(currentGold)}g unspent`;
      coaching='When the bank can become meaningful combat power, reset before volunteering for another high-risk fight.';
    }else if(rank>0&&rank<=2&&death){
      behaviour='Carry Preservation';domain='TEAMFIGHTS';severity+=15;
      title='High-value carry death';
      coaching='Your life was carrying a high share of team economy. Preserve the first threat cycle before committing for damage.';
    }else if(repeat>=2&&death){
      behaviour='Threat Adaptation';domain='VISION_MAP';severity+=12;
      title=`${enemy} punished you again`;
      coaching=`After ${enemy} shows the same access pattern once, change the next interaction instead of offering the same angle again.`;
    }

    const decision=death
      ?`At ${clock(seconds)}, you died${enemy?` to ${enemy}`:''}${currentGold>=900?` while holding about ${Math.round(currentGold)}g`:'v'}.`
      :`At ${clock(seconds)}, you ${event.killerId===myId?'secured the kill':'assisted the kill'} on ${enemy}.`;
    const consequence=nextConversion
      ?`${nextConversion.name} was ${death?'taken by the enemy':'secured by your team'} ${Math.round((nextConversion.atMs-event.timestamp)/1000)}s later.`
      :death
        ?'No major objective or tower conversion was recorded inside the immediate consequence window.'
        :'No major objective or tower conversion was recorded inside the immediate conversion window.';

    const evidence:ReconstructionEvidence[]=[
      {kind:'VERIFIED',atSeconds:seconds,label:death?'Death':'Positive fight',detail:decision},
      ...before.evidence,
    ];
    if(nextConversion){
      evidence.push({kind:'VERIFIED',atSeconds:nextConversion.atMs/1000,label:nextConversion.name,detail:`${death?'Enemy':'Your team'} conversion recorded by Riot timeline.`});
      evidence.push({kind:'CONNECTED',label:'Sequence link',detail:`The fight event and ${nextConversion.name.toLowerCase()} were ${Math.round((nextConversion.atMs-event.timestamp)/1000)}s apart.`});
    }
    if(rank>0&&rank<=2&&death)evidence.push({kind:'VERIFIED',atSeconds:seconds;label:'Team economy rank',detail:`You were #${rank} on your team in total gold in the nearest Riot frame.`});
    if(repeat>=2&&death*evidence.push({kind:'VERIFIED',atSeconds:seconds;label:'Repeated threat',detail:`This was death #${repeat} to ${enemy} in the Riot timeline.`});
    evidence.push({kind:'COACHING_INFERENCE',label:behaviour,detail:coaching});

    stories.push({
      id:`riot-${event.timestamp}-${death?'death':'positive'}`,
      side:death?'CRITICAL':'GOOD',atSeconds:seconds,clock:clock(seconds),title,behaviourLabel:behaviour,dnaDomain:domain,
      before:before.text,decision,consequence,coaching,evidence,source:'MATCH_V5_TIMELINE',
      confidence:nextConversion||currentGold>=1200||(drank>0&&rank<=2)?'HIGH':'MEDIUM',severity,
    });
  }

  for(const event of events.filter(e=>e.type==='ELITE_MONSTER_KILL')){
    const team=eventTeam(dto,event);
    if(team!==myTeam)continue;
    const involved=event.killerId===myId||(event.assistingParticipantIds??[]).includes(myId);
    if(!involved)continue;
    const seconds=event.timestamp/1000,name=objectiveName(event);

    const before=stateBeforeRiot(timeline,events,myId,event.timestamp);
    const prior=interactions.filter(x=>x.timestamp<event.timestamp&&event.timestamp-x.timestamp<=75_000&&x.victimId!==myId).at(-1);
    const consequence=prior?`${name} followed your team's positive fight sequence ${Math.round((event.timestamp-prior.timestamp)/1000)}s later.`:`You were directly involved when your team secured ${name}.`;
    stories.push({
      id:`riot-objective-${event.timestamp}`,side:'GOOD',atSeconds:seconds,clock:clock(seconds),title:`Present for ${name}`,
      behaviourLabel:'Objective Readiness',dnaDomain:'OBJECTIVES',before:before.text,
      decision:`At ${clock(seconds)}, Riot recorded you as directly involved in securing ${name}.`,consequence,
      coaching:'Repeat the readiness pattern: arrive alive, connected and able to participate when the objective is actually taken.',
      evidence:[ {kind:'VERIFIED',atSeconds:seconds;label:name,detail:'Riot timeline recorded your direct kill/assist involvement.'},
        ...(prior?[{kind:'CONNECTED' as const,label:'Fight â†’ objective',detail:`A positive fight interaction occurred ${Math.round((event.timestamp-prior.timestamp)/1000)}s before the objective.`}]:[]),
        {kind:'COACHING_INFERENCE',label:'Objective Readiness',detail:'Being alive and directly involved at the secure is positive objective-readiness evidence.'}],
      source:'MATCH_V5_TIMELINE',confidence:'HIGH',severity:65,
    });
  }

  return {version:2,source:'MATCH_V5_TIMELINE',generatedAt:new Date().toISOString(),stories:dedupeStories(stories),boundary:BOUNDARY};
}

 export function buildLiveMatchReconstruction(snapshots:LiveTelemetrySnapshot[],summary:StrengthTimeline,decisionGraph?:DecisionGraph|null):MatchReconstruction|null {
  const ordered=[...snapshots].sort((a,b)=>a.gameTime-b.gameTime);
  if(!ordered.length)return null;
  const liveEvents=uniqueLiveEvents(ordered);
  const stories:MatchReconstructionStory[]=[];

  for(const fight of summary.fightReviews??[]){
    const side:ReconstructionSide=fight.outcome==='DEATH'?'CRITICAL':'GOOD';
    const before=stateBeforeLive(ordered,fight.atSeconds);
    const nextObjective=liveEvents.find(event=>event.time>fight.atSeconds&&event.time-fight.atSeconds<=75&&isObjectiveEvent(event));
    const node=nearestNode(decisionGraph,fight.atSeconds);
    const behaviour=node?.behaviourLabel||liveBehaviour(fight,nextObjective);
    const domain=dnaForBehaviour(behaviour);
    const objectiveLabel=nextObjective?eventLabel(nextObjective):null;
    const consequence=objectiveLabel
      ?`${objectiveLabel} appeared in the local event feed ${Math.round(nextObjective.time-fight.atSeconds)}s later.`
      :fight.summary;
    const coaching=node?.counterfactual?.alternative||node?.coachingResponse?.cue||fight.betterDecision?.[0]||(side==='GOOD'?fight.howToWin?.[0]:null)??'Repeat the decision conditions that produced the better outcome.';
    const evidence:ReconstructionEvidence[]=[
      {kind:'VERIFIED',atSeconds:fight.atSeconds;label:fight.outcome,detail:fight.summary},
      ...before.evidence,
    ];
    if(nextObjective&&objectiveLabel){
      evidence.push({kind:'VERIFIED',atSeconds:nextObjective.time,label:objectiveLabel,detail:'Recorded by the local Riot event feed.'});
      evidence.push({kind:'CONNECTED',label:'Sequence link',detail:`The fight event and ${objectiveLabel.toLowerCase()} were ${Math.round(nextObjective.time-fight.atSeconds)}s\\˜JNÂˆBˆ]šY[˜ÙKœ\Ú
ÚÚ[™‰ÐÓÐPÒS‘×ÒS‘‘T‘SÑIËX™[˜™Z]š[Ý\‹]Z[˜ÛØXÚ[™ßJNÂˆÝÜšY\Ëœ\Ú
ÂˆY˜]™KIÙšYÚ˜]ÙXÛÛ™ßKIÙšYÚ›Ý]ÛÛY_XÚYK]ÙXÛÛ™Î™šYÚ˜]ÙXÛÛ™ËÛØÚÎ˜ÛØÚÊšYÚ˜]ÙXÛÛ™ÊKˆ]N››ÙOË]_šYÚšXY[™K™Z]š[Ý\“X™[˜™Z]š[Ý\‹˜QÛXZ[Ž™ÛXZ[‹™Y›Ü™N˜™Y›Ü™K^ˆXÚ\Ú[ÛŽ››ÙOË™XÚ\Ú[Û”™XYšYÚœÝ[[X\žKÛÛœÙ\]Y[˜ÙKÛØXÚ[™Ë]šY[˜ÙKÛÝ\˜ÙN‰ÓU‘WÕSSQU–IËÛÛ™šY[˜ÙN››ÙOË˜ÛÛ™šY[˜Ù_
šYÚ™\™XÝOOIÑU‘S‰ÏÉÓQQUSIÎ‰ÒQÒ	ÊKˆÙ]™\š]NŠÚYOOOIÐÔ’UPÐS	ÏÍMNJJÊ™^Øš™XÝ]™OÌŒŒ
JÊšYÚ™]šY[˜ÙK˜Ý\œ™[ÛÛLLŒ	‰œÚYOOOIÐÔ’UPÐS	ÏÌMNŒ
KˆJNÂˆB‚ˆ™]\›ˆÝ™\œÚ[ÛŽŒ‹ÛÝ\˜ÙN‰ÓU‘WÕSSQU–IËÙ[™\˜]Y]›™]È]J
KÒTÓÔÝš[™Ê
KÝÜšY\Î™Y\TÝÜšY\ÊÝÜšY\ÊK›Ý[™\žN“ÕS‘T–_NÂŸB‚™[˜Ý[ÛˆÝ]P™Y›Ü™Tš[Ý
[Y[[™N”š[Ý[Y[[™QË]™[Î”š[Ý[Y[[™Q]™[×KY›[X™\‹]\Î›[X™\Ê^ÂˆÛÛœÝœ˜[YOYœ˜[YP]
[Y[[™KX]›X^
]\ËLMWÌ
JOÏÙœ˜[YP]
[Y[[™K]\ÊNÂˆÛÛœÝYœ˜[YOËœ\XÚ\[œ˜[Y\ÖÔÝš[™ÊY
WNÂˆÛÛœÝÜÏJË›Z[š[ÛœÒÚ[YÏÌ
JÊËš[™ÛSZ[š[ÛœÒÚ[YÏÌ
NÂˆÛÛœÝ™XÙ[\˜Ú\Ù\ÏY]™[Ë™š[\ŠOO™K\OOOIÒUSWÔTÒTÑQ	É‰™Kœ\XÚ\[YOO\Y	‰™K[Y\Ý[\]\É‰˜]\ËYK[Y\Ý[\NLÌ
K›[™ÝÂˆÛÛœÝ\ÏVÂˆË›]™[Ø]™[	Ü›]™[X‰ÉËˆ\[ÙˆË˜Ý\œ™[ÛÛOOIÛ[X™\‰ÏØ	ÓX]œ›Ý[™
˜Ý\œ™[ÛÛ
_YÈ[œÜ[‰ÉËˆ[X™\‹š\Ñš[š]JÜÊOØ	ØÜßHÔØ‰ÉËˆ™XÙ[\˜Ú\Ù\ÏØ	Ü™XÙ[\˜Ú\Ù\ßH\˜Ú\ÙH]™[	Ü™XÙ[\˜Ú\Ù\ÏOOLOÉÉÎ‰ÜÉßH[ˆH™]š[Ý\ÈLØ‰ÉËˆK™š[\Š›ÛÛX[ŠNÂˆÛÛœÝ^\\Ë›[™ÝØX›Ý]M\È™Y›Ü™HH[ÛY[H™X\™\Ýš[Ýœ˜[YHÚÝÙY	Ü\Ëš›Ú[Š	È0­È	Ê_K˜‰Ôš[ÝY›Ý^ÜÙHH™[XX›H\XÚ\[œ˜[YH[[YYX][H™Y›Ü™H\È[ÛY[‰ÎÂˆÛÛœÝ]šY[˜ÙN”™XÛÛœÝXÝ[Û‘]šY[˜ÙV×O\\Ë›[™ÝÖÞÚÚ[™‰Õ‘T’Q’QQ	Ë]ÙXÛÛ™ÎŠœ˜[YOË[Y\Ý[\ÏØ]\ÊKÌLX™[‰Ô™K[[ÛY[Ý]IË]Z[^WN–×NÂˆ™]\›žÝ^]šY[˜Ù_NÂŸB‚™[˜Ý[ÛˆÝ]P™Y›Ü™S]™JÛ˜\ÚÝÎ“]™U[[Y]žTÛ˜\ÚÝ×K]ÙXÛÛ™Î›[X™\Š^ÂˆÛÛœÝ\™Ù]X]ÙXÛÛ™ËLLŽÂˆ]Û˜\ÚÝ“]™U[[Y]žTÛ˜\ÚÝ[[[Âˆ›ÜŠÛÛœÝØ[™Y]HÙˆÛ˜\ÚÝÊ^ÚYŠØ[™Y]K™Ø[YU[YO]\™Ù]
\Û˜\ÚÝXØ[™Y]NÙ[ÙHœ™XZßBˆÛ˜\ÚÝÏ\Û˜\ÚÝËœ™YXÙJ
™\Ý][JOO“X]˜XœÊ][K™Ø[YU[YK]\™Ù]
OX]˜XœÊ™\Ý™Ø[YU[YK]\™Ù]
OÚ][N˜™\ÝÛ˜\ÚÝÖÌJNÂˆÛÛœÝYOYš[™YS]™JÛ˜\ÚÝ
NÂˆÛÛœÝ\Û˜\ÚÝ˜XÝ]™KœÝ]Ë˜Ý\œ™[X[	‰œÛ˜\ÚÝ˜XÝ]™KœÝ]Ë›X^X[ÓX]œ›Ý[™
Û˜\ÚÝ˜XÝ]™KœÝ]Ë˜Ý\œ™[X[ÜÛ˜\ÚÝ˜XÝ]™KœÝ]Ë›X^X[
ŒL
N›[ÂˆÛÛœÝ\ÏVÂˆ]™[	ÜÛ˜\ÚÝ˜XÝ]™K›]™[YOË›]™[Xˆ	ÓX]œ›Ý[™
Û˜\ÚÝ˜XÝ]™K˜Ý\œ™[ÛÛ
_YÈ[œÜ[ˆYOØ	ÛYKœØÛÜ™\Ë˜Ü™Y\ØÛÜ™_HÔØ‰ÉËˆOO[[Ø	ÚIH‰ÉËˆYOÉÓX]œ›Ý[™
YKš][QÛÛ
_YÈš\ÚX›H][\Ø‰ÉËˆK™š[\Š›ÛÛX[ŠNÂˆÛÛœÝ^X\›Ý[™	ØÛØÚÊÛ˜\ÚÝ™Ø[YU[YJ_KHÛÛ\[š[Ûˆ™XÛÜ™Y	Ü\Ëš›Ú[Š	È0­È	Ê_K˜Âˆ™]\›žÝ^]šY[˜ÙN–ÞÚÚ[™‰Õ‘T’Q’QQ	È\ÈÛÛœÝ]ÙXÛÛ™ÎœÛ˜\ÚÝ™Ø[YU[YKX™[‰Ô™K[[ÛY[Û˜\ÚÝ	Ë]Z[^W_NÂŸB‚™[˜Ý[Ûˆœ˜[YP]
[Y[[™N”š[Ý[Y[[™QË[Y\Ý[\›[X™\ŠN”š[Ý[Y[[™Qœ˜[Y_[Û]™\Ý”š[Ý[Y[[™Qœ˜[Y_[[[Ù›ÜŠÛÛœÝœ˜[YHÙˆ[Y[[™Kš[™›Ë™œ˜[Y\Ê^ÚYŠœ˜[YK[Y\Ý[\][Y\Ý[\
X™\ÝYœ˜[YNÙ[ÙHœ™XZß\™]\›ˆ™\ÝB™[˜Ý[Ûˆ\XÚ\[˜[YJÎ”š[ÝX]ÚËYÎ›[X™\Š^Ü™]\›ˆËš[™›Ëœ\XÚ\[Ë™š[™
Oœœ\XÚ\[YOOZY
OË˜Ú[\[Û“˜[YOÏ
YØ\XÚ\[	ÚYX‰ÝH[™[^IÊ_B™[˜Ý[ÛˆX[QÛÛ˜[šÊÎ”š[ÝX]ÚË[Y[[™N”š[Ý[Y[[™QË[Y\Ý[\›[X™\‹YN”š[ÝX]ÚÖÉÚ[™›É×VÉÜ\XÚ\[É×VÛ[X™\—J^ØÛÛœÝœ˜[YOYœ˜[YP]
[Y[[™K[Y\Ý[\
NÚYŠYœ˜[YJ\™]\›ˆØÛÛœÝX[OYËš[™›Ëœ\XÚ\[Ë™š[\ŠOœX[RYOO[YKX[RY
K›X\
OŠÚYœœ\XÚ\[YÛÛ™œ˜[YKœ\XÚ\[œ˜[Y\ÖÔÝš[™Êœ\XÚ\[Y
WOËÝ[ÛÛÏÌJJKœÛÜ

KŠOO˜‹™ÛÛXK™ÛÛ
NÜ™]\›ˆX[K™š[™[™^
›ÝÏOœ›ÝËšYOO[YKœ\XÚ\[Y
JÌ_B™[˜Ý[Ûˆ]™[X[JÎ”š[ÝX]ÚË]™[”š[Ý[Y[[™Q]™[
^ÚYŠ\[Ùˆ]™[šÚ[\•X[RYOOIÛ[X™\‰Ê\™]\›ˆ]™[šÚ[\•X[RYØÛÛœÝÚ[\YËš[™›Ëœ\XÚ\[Ë™š[™
Oœ\XÚ\[YOOY]™[šÚ[\’Y
NÚYŠÚ[\Š\™]\›ˆÚ[\‹X[RYÚYŠ]™[\OOOIÐ•RSS‘×ÒÒS	É‰\[Ùˆ]™[X[RYOOIÛ[X™\‰Ê\™]\›ˆ]™[X[RYOOLLÌŒŒLÜ™]\›ˆ[B™[˜Ý[ÛˆØš™XÝ]™S˜[YJ]™[”š[Ý[Y[[™Q]™[
^ÚYŠ]™[\OOOIÐ•RSS‘×ÒÒS	Ê\™]\›ˆ	ÔÝš[™Ê]™[›[™U\_	ÉÊKœ™\XÙJ×ÓS‘IË	ÉÊKÓÝÙ\Ø\ÙJ
_	ÛX\	ßH	ÔÝš[™Ê]™[ÝÙ\•\_]™[˜Z[[™Õ\_	ÝÝÙ\‰ÊKœ™\XÙJ×ËÙË	È	ÊKÓÝÙ\Ø\ÙJ
_XÚYŠ]™[›[ÛœÝ\•\OOOIÐT“Ó—ÓTÒÔ‰Ê\™]\›‰Ð˜\›Û‰ÎÚYŠ]™[›[ÛœÝ\•\OOOIÔ’Q•TS	Ê\™]\›‰Ò\˜[	ÎÚYŠ]™[›[ÛœÝ\•\OOOIÒÔ‘IÊ\™]\›‰Õ›ÚYÜXœÉÎÚYŠ]™[›[ÛœÝ\•\OOOIÐURÒS‰Ê\™]\›‰Ð]ZÚ[‰ÎÚYŠ]™[›[ÛœÝ\•\OOOIÑQÓÓ‰ŠÉ™]™[›[ÛœÝ\”ÝX•\J\™]\›ˆÝš[™Ê]™[›[ÛœÝ\”ÝX•\JKœ™\XÙJ	×ÑQÓÓ‰Ë	ÉÊKÓÝÙ\Ø\ÙJ
JÉÈ˜YÛÛ‰ÎÚYŠ]™[›[ÛœÝ\•\OOOIÑQÓÓ‰Ê\™]\›‰Ù˜YÛÛ‰ÎÜ™]\›‰ÛØš™XÝ]™IßB™[˜Ý[Ûˆš[™ÛÛ™\œÚ[ÛY\Š]™[Î”š[Ý[Y[[™Q]™[×KÎ”š[ÝX]ÚË^UX[N›[X™\‹]\Î›[X™\‹Ú[™ÝÓ\Î›[X™\‹ÚYN‰ÐSIß	ÑS‘SVIÊ^Ù›ÜŠÛÛœÝ]™[Ùˆ]™[Ê^ÚYŠ]™[[Y\Ý[\X]\ß]™[[Y\Ý[\X]\ÏÚ[™ÝÓ\ÊXÛÛ[YNÚYŠ]™[\HOOIÑSUWÓSÓ”ÕT—ÒÒS	É‰™]™[\HOOIÐ•RSS‘×ÒÒS	ÊXÛÛ[YNØÛÛœÝX[OY]™[X[JË]™[
NÚYŠX[OOO[[
XÛÛ[YNØÛÛœÝØ[Y\ÚYOOOIÐSIÏÝX[OOO[^UX[NX[HOO[^UX[NÚYŠØ[Y
\™]\›žØ]\Î™]™[[Y\Ý[\˜[YN›Øš™XÝ]™S˜[YJ]™[
KÚ[™™]™[\OOOIÑSUWÓSÓ”ÕT—ÒÒS	ÏÉÓÐ’‘PÕU‘IÈ\ÈÛÛœÝ‰ÕÕÑT‰È\ÈÛÛœÝ_\™]\›ˆ[B™[˜Ý[Ûˆš[™YS]™JÛ˜\ÚÝ“]™U[[Y]žTÛ˜\ÚÝ
N“]™U[[Y]žT^Y\Ÿ[ØÛÛœÝš[ÝY\Û˜\ÚÝ˜XÝ]™Kœš[ÝYÝ[[[Û™\\Û˜\ÚÝ˜XÝ]™KœÝ[[[Û™\“˜[YNÜ™]\›ˆÛ˜\ÚÝœ^Y\œË™š[™
O›ÛÛX[Šš[ÝY	‰œœš[ÝYOO\š[ÝY
JOÏÜÛ˜\ÚÝœ^Y\œË™š[™
O›ÛÛX[ŠÝ[[[Û™\‰‰œœÝ[[[Û™\“˜[YOOO\Ý[[[Û™\ŠJOÏÜÛ˜\ÚÝœ^Y\œË™š[™
Oœ˜Ú[\[Û“˜[YOOO\Û˜\ÚÝ˜XÝ]™K˜Ú[\[Û“˜[YI‰œX[OOO\Û˜\ÚÝ˜XÝ]™KX[JOÏÛ[B™[˜Ý[Ûˆ[š\]YS]™Q]™[ÊÛ˜\ÚÝÎ“]™U[[Y]žTÛ˜\ÚÝ×J^ØÛÛœÝX\[™]ÈX\Ýš[™Ë]™U[[Y]žQ]™[Š
NÙ›ÜŠÛÛœÝÛ˜\ÚÝÙˆÛ˜\ÚÝÊY›ÜŠÛÛœÝ]™[ÙˆÛ˜\ÚÝ™]™[Ê^ØÛÛœÝÙ^OY]™[šYOO[[ØY‰Ù]™[šYX˜	Ù]™[›˜[Y_N‰Ù]™[[Y_N‰Ù]™[˜XÝÜŸ	ÉßN‰Ù]™[\™Ù]	ÉßXÛX\œÙ]
Ù^K]™[
_\™]\›–Ë‹‹›X\˜[Y\Ê
WKœÛÜ

KŠOO˜K[YKX‹[YJ_B™[˜Ý[Ûˆ\ÓØš™XÝ]™Q]™[
]™[“]™U[[Y]žQ]™[
^Ü™]\›ˆÙ˜YÛÛŸ˜\›ÛŸ\˜[Ü™_›ÚYÜXŸ]ZÚ[Ÿ\œ™]ÝÙ\Ÿ[šX‹ÚK\Ý
]™[›˜[YJ_B™[˜Ý[Ûˆ]™[X™[
]™[“]™U[[Y]žQ]™[
^Ü™]\›ˆÛX[Š]™[›˜[YJKœ™\XÙJÊØK^—JJÐKV—JKÙË	ÉH	‰Ê_	ÛØš™XÝ]™H]™[	ßB™[˜Ý[Ûˆ™X\™\Ý›ÙJÜ˜\‘XÚ\Ú[Û‘Ü˜\[™Yš[™Y[ÙXÛÛ™Î›[X™\Š^ÚYŠYÜ˜\
\™]\›ˆ[Û]™\ÝYÜ˜\››Ù\ÖÌOÏÛ[Ù›ÜŠÛÛœÝ›ÙHÙˆÜ˜\››Ù\Ê^ÚYŠX™\ÝX]˜XœÊ›ÙK˜]ÙXÛÛ™Ë\ÙXÛÛ™ÊOX]˜XœÊ™\Ý˜]ÙXÛÛ™Ë\ÙXÛÛ™ÊJX™\Ý[›Ù_\™]\›ˆ™\Ý	‰“X]˜XœÊ™\Ý˜]ÙXÛÛ™Ë\ÙXÛÛ™ÊOLNØ™\Ý›[B™[˜Ý[Ûˆ]™P™Z]š[Ý\ŠšYÚ‘šYÚ™]šY]Ë™^Øš™XÝ]™OÎ“]™U[[Y]žQ]™[
^ÚYŠ™^Øš™XÝ]™J\™]\›‰ÓØš™XÝ]™H™XY[™\ÜÉÎÚYŠšYÚ›Ý]ÛÛYOOOIÑPU	É‰™šYÚ™]šY[˜ÙK˜Ý\œ™[ÛÛLLŒ
\™]\›‰Ô™\Ù]\ØÚ\[™IÎÚYŠšYÚ›Ý]ÛÛYOOOIÑPU	É‰™šYÚ™\™XÝOOIÖSÕWÔÕ“Ó‘ÑT‰Ê\™]\›‰ÓXY›ÝXÝ[Û‰ÎÚYŠšYÚ›Ý]ÛÛYOOOIÑPU	Ê\™]\›‰ÑšYÚÙ[XÝ[Û‰ÎÜ™]\›‰ÑšYÚÛÛ™\œÚ[Û‰ßB™[˜Ý[Ûˆ˜Q›Ü™Z]š[Ý\ŠX™[œÝš[™ÊN‘˜QÛXZ[žØÛÛœÝ[X™[ÓÝÙ\Ø\ÙJ
NÚYŠÛØš™XÝ]™KË\Ý
ŠJ\™]\›‰ÓÐ’‘PÕU‘TÉÎÚYŠÜ™\Ù]˜\›_Ø]™KË\Ý
ŠJ\™]\›‰ÕÐU‘T×ÐÔÉÎÚYŠÝ™X]Y\š\Ú[ÛŸX\Ë\Ý
ŠJ\™]\›‰Õ’TÒSÓ—ÓPT	ÎÚYŠÙšYÚØ\œž_Ý\š]˜[XYË\Ý
ŠJ\™]\›‰ÕPSQ’QÒÉÎÚYŠØÛÛœÚ\Ý[Ÿ™XÛÝ™\žKË\Ý
ŠJ\™]\›‰ÐÓÓ”ÒTÕSÖIÎÜ™]\›‰ÓS’S‘ÉßB™[˜Ý[ÛˆY\TÝÜšY\ÊÝÜšY\Î“X]Ú™XÛÛœÝXÝ[Û”ÝÜžV×J^ØÛÛœÝÜ™\™YVË‹‹œÝÜšY\×KœÛÜ

KŠOO˜‹œÙ]™\š]KXKœÙ]™\š]_K˜]ÙXÛÛ™ËX‹˜]ÙXÛÛ™ÊNØÛÛœÝÙY[[™]ÈÙ]Ýš[™ÏŠ
NØÛÛœÝÙ\“X]Ú™XÛÛœÝXÝ[Û”ÝÜžV×OV×NÙ›ÜŠÛÛœÝÝÜžHÙˆÜ™\™Y
^ØÛÛœÝÙ^OX	ÜÝÜžKœÚY_N‰ÜÝÜžK˜™Z]š[Ý\“X™[N‰ÓX]œ›Ý[™
ÝÜžK˜]ÙXÛÛ™ËÌŒ
_XÚYŠÙY[‹š\ÊÙ^JJXÛÛ[YNÜÙY[‹˜Y
Ù^JNÚÙ\œ\Ú
ÝÜžJ_\™]\›ˆÙ\œÛÜ

KŠOO˜K˜]ÙXÛÛ™ËX‹˜]ÙXÛÛ™Ê_B