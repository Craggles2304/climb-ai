import {Match,Mission,PlayerProfile,RiotAccount} from '@/lib/types';
export const demoProfile:PlayerProfile={role:'ADC',rank:'Gold',champions:["Kog'Maw",'Aphelios','Jinx'],frustration:'I do not know what to do after lane',founder:true};
export const demoAccounts:RiotAccount[]=[
{id:'acct-main',label:'MAIN',gameName:'ExampleADC',tagline:'#EUW',region:'EUW',role:'ADC',rank:'Gold IV · 38 LP',champions:["Kog'Maw",'Aphelios','Jinx'],isPrimary:true,syncStatus:'DEMO'},
{id:'acct-alt',label:'ALT',gameName:'Kraggles',tagline:'#2304',region:'EUW',role:'ADC',rank:'Platinum IV · 12 LP',champions:['Aphelios',"Kai'Sa",'Jinx'],syncStatus:'DEMO'},
{id:'acct-jungle',label:'JUNGLE',gameName:'ODTest',tagline:'#EUW',region:'EUW',role:'JUNGLE',rank:'Silver I · 64 LP',champions:['Shen','Viego','Xin Zhao'],syncStatus:'DEMO'}
];
const mainRows=[
['WIN',"Kog'Maw",'Caitlyn',7,3,9,221,34.2,6.46,78,116,6.8,6.2,120,64,0,1,2,0,2,11.4,21.8],
['LOSS','Aphelios','Draven',7,4,8,214,34.35,6.23,76,113,6.6,5.9,-310,-140,1,1,2,1,2,12.1,23.2],
['WIN','Jinx','Ashe',9,5,7,195,31.6,6.17,73,109,6.4,5.7,95,22,0,2,3,1,3,11.8,22.4],
['LOSS',"Kog'Maw",'Kai\'Sa',4,7,5,166,30.8,5.39,69,101,6.0,4.8,-430,-220,1,2,4,2,4,13.0,24.9],
['WIN','Aphelios','Ezreal',8,4,10,203,32.2,6.30,75,111,6.5,5.9,180,90,0,1,3,1,2,11.6,22.0],
['LOSS','Jinx','Jhin',3,6,4,154,29.4,5.24,66,97,5.8,4.6,-520,-260,1,2,3,2,3,13.4,25.0],
['WIN',"Kog'Maw",'Sivir',11,3,6,198,30.5,6.49,80,119,6.9,6.1,250,130,0,1,2,0,2,10.9,21.1],
['WIN','Aphelios','Xayah',6,5,12,188,33.4,5.63,72,106,6.2,5.1,-40,10,0,2,3,1,3,12.5,23.8],
['LOSS','Jinx','Caitlyn',5,8,7,171,32.9,5.20,65,96,5.7,4.5,-610,-300,2,2,4,2,4,13.7,26.1],
['WIN',"Kog'Maw",'Varus',8,7,11,185,34.1,5.43,70,103,6.0,4.9,-180,-70,1,2,4,1,4,12.7,24.0]
,
// Extended to 30 games so the cost-of-leak engine clears its sample gate.
// Same story the rest of the demo tells: this account separates on post-15 farm.
["WIN","Kog'Maw","Caitlyn",6,3,7,192,29.5,6.51,71,99,6.6,6.4,60,20,0,2,1,1,2,11,21],
["WIN","Aphelios","Draven",11,3,14,220,32.3,6.81,73,102,6.8,6.8,107,49,0,1,2,0,2,11.3,21.7],
["LOSS","Jinx","Ashe",9,3,13,228,35.1,6.5,76,105,7,6.1,154,78,0,1,2,0,3,11.6,22.4],
["WIN","Kog'Maw","Kai'Sa",7,2,12,204,31.6,6.46,73,101,6.7,6.2,201,107,0,1,1,0,1,11.9,21.1],
["WIN","Aphelios","Ezreal",12,4,11,240,34.4,6.98,75,104,6.9,7,248,136,0,2,2,1,3,11.2,21.8],
["WIN","Jinx","Jhin",10,3,10,199,30.9,6.44,71,99,6.6,6.3,295,165,0,1,2,0,2,11.5,22.5],
["LOSS","Kog'Maw","Sivir",8,2,9,214,33.7,6.35,73,102,6.8,6,82,44,0,1,1,0,2,11.8,21.2],
["WIN","Aphelios","Xayah",6,3,8,205,30.2,6.79,76,105,7,6.6,129,73,0,1,2,0,2,11.1,21.9],
["WIN","Jinx","Varus",11,4,7,225,33,6.82,73,101,6.7,6.9,176,102,0,2,2,1,3,11.4,22.6],
["LOSS","Kog'Maw","Samira",9,2,14,194,29.5,6.58,75,104,6.9,6.2,223,131,0,1,1,0,1,11.7,21.3],
["WIN","Aphelios","Lucian",7,3,13,211,32.3,6.53,71,99,6.6,6.5,270,160,0,1,2,0,3,11,22],
["WIN","Jinx","Tristana",5,6,4,202,35.1,5.75,67,93,6.2,5.4,-371,-237,0,2,4,2,3,12.9,24.9],
["LOSS","Kog'Maw","Caitlyn",3,4,3,167,31.6,5.28,64,89,5.9,4.7,-432,-274,1,1,2,1,3,12.4,24.2],
["LOSS","Aphelios","Draven",6,5,8,194,34.4,5.64,67,93,6.2,5.2,-493,-81,0,2,3,2,2,13.1,25.3],
["LOSS","Jinx","Ashe",4,5,7,159,30.9,5.15,64,89,5.9,4.4,-134,-118,0,1,4,1,4,12.6,24.6],
["LOSS","Kog'Maw","Kai'Sa",2,5,6,198,33.7,5.88,67,93,6.2,5.6,-195,-155,1,2,2,2,2,13.3,23.9],
["LOSS","Aphelios","Ezreal",5,4,5,163,30.2,5.4,64,89,5.9,4.9,-256,-192,0,1,3,1,3,12.8,25],
["LOSS","Jinx","Jhin",3,6,4,197,33,5.97,67,93,6.2,5.8,-317,-229,0,2,4,2,3,13.5,24.3],
["LOSS","Kog'Maw","Sivir",6,4,3,150,29.5,5.08,64,89,5.9,4.2,-378,-266,1,1,2,1,3,13,23.6],
["LOSS","Aphelios","Xayah",4,5,8,181,32.3,5.6,67,93,6.2,5.1,-439,-73,0,2,3,2,2,12.5,24.7]
] as const;

/**
 * Session-clustered timestamps. Games sit ~35 minutes apart inside a session and
 * sessions sit a day or two apart, which is how ranked actually gets played.
 * Index 0 is the most recent game.
 */
const SESSION_SIZES=[3,2,4,3,2,3,4,2,3,4];
const PLAYED_AT:string[]=(()=>{
  const out:string[]=[];
  let t=Date.now()-25*60_000;          // last game finished 25 minutes ago
  let i=0;
  for(const size of SESSION_SIZES){
    for(let g=0;g<size&&i<40;g++,i++){
      out.push(new Date(t).toISOString());
      t-=35*60_000;                    // previous game in the same session
    }
    t-=26*60*60_000;                   // previous session, a day or so earlier
  }
  return out;
})();
const playedAt=(i:number)=>PLAYED_AT[i]??new Date(Date.now()-i*86400000).toISOString();

function makeMain(r:typeof mainRows[number],i:number):Match{return {id:`main-${i+1}`,riotAccountId:'acct-main',champion:r[1],opponent:r[2],role:'ADC',result:r[0],kills:r[3],deaths:r[4],assists:r[5],durationSeconds:Math.round(r[7]*60),rank:'Gold IV',metrics:{cs:r[6],csPerMin:r[8],deaths:r[4],goldPerMin:385+i*5,damagePerMin:650+i*13,damageShare:.27+i*.004,killParticipation:.56+i*.008,objectiveParticipation:.48+i*.015,csAt10:r[9],csAt15:r[10],laneCsPerMin:r[11],post15CsPerMin:r[12],goldDiffAt15:r[13],xpDiffAt15:r[14],deathsPre10:r[15],deaths10to20:r[16],deathsPost20:r[17],soloDeaths:r[18],teamfightDeaths:r[19],firstItemMinute:r[20],secondItemMinute:r[21],levelAt15:r[14]>=0?9:8,visionScore:17+i},items:['Berserker\'s Greaves','Guinsoo\'s Rageblade','Blade of the Ruined King'],summoners:['Flash','Barrier'],source:'demo',createdAt:playedAt(i)}}
const LOSS_STREAK_FIRST=[1,3,5];
const orderedMainRows=[
  ...LOSS_STREAK_FIRST.map(i=>mainRows[i]),
  ...mainRows.filter((_,i)=>!LOSS_STREAK_FIRST.includes(i)),
];
const main=orderedMainRows.map(makeMain);
const alt:Match[]=main.slice(0,7).map((m,i)=>({...m,id:`alt-${i+1}`,riotAccountId:'acct-alt',champion:i%2?'Aphelios':"Kai'Sa",rank:'Platinum IV',metrics:{...m.metrics,csPerMin:+(m.metrics.csPerMin+.55).toFixed(2),laneCsPerMin:(m.metrics.laneCsPerMin||0)+.4,post15CsPerMin:(m.metrics.post15CsPerMin||0)+.6,deaths:Math.max(2,m.deaths-1)},deaths:Math.max(2,m.deaths-1)}));
const jungle:Match[]=main.slice(0,6).map((m,i)=>({...m,id:`jg-${i+1}`,riotAccountId:'acct-jungle',champion:i%3===0?'Shen':i%3===1?'Viego':'Xin Zhao',opponent:i%2?'Lee Sin':'Nocturne',role:'JUNGLE',rank:'Silver I',metrics:{...m.metrics,csPerMin:+(5.1+i*.12).toFixed(2),objectiveParticipation:.62+i*.03,killParticipation:.61+i*.025,visionScore:22+i*2}}));
export const demoMatches:Match[]=[...main,...alt,...jungle];
export const matchesFor=(accountId:string)=>demoMatches.filter(m=>m.riotAccountId===accountId);
export const missionFor=(accountId:string):Mission=> accountId==='acct-jungle'?{id:'mission-jg-1',riotAccountId:accountId,category:'OBJECTIVES',title:'OBJECTIVE TEMPO',metric:'objectiveParticipation',target:70,unit:'% objective participation',gamesRequired:3,gamesCompleted:1,successfulGames:1,rules:['Recall with enough time to be on map before neutral objectives.','Do not start low-percentage invades when an objective spawns inside 60 seconds.','Track enemy jungle side before committing to dragon or Herald.'],status:'PRACTISE',createdAt:new Date().toISOString()}:{id:`mission-${accountId}`,riotAccountId:accountId,category:'RESOURCE_COLLECTION',title:'POST-LANE ECONOMY',metric:'post15CsPerMin',target:6.0,unit:'post-15 CS/min',gamesRequired:3,gamesCompleted:2,successfulGames:1,rules:['After recall post-15, identify the next safe wave before defaulting mid.','If an objective is >60 seconds away, collect available guaranteed gold first.','Do not cross into an unsafe side lane without information on the main engage threats.'],status:'REPEAT',createdAt:new Date().toISOString()};
export const demoMission=missionFor('acct-main');
