import {Match,Mission,PlayerProfile,RiotAccount} from '@/lib/types';
export const demoProfile:PlayerProfile={role:'ADC',rank:'Gold',champions:["Kog'Maw",'Aphelios','Jinx'],frustration:'I do not know what to do after lane',founder:true};
export const demoAccounts:RiotAccount[]=[
{id:'acct-main',label:'MAIN',gameName:'ExampleADC',tagline:'#EUW',region:'EUW',role:'ADC',rank:'Gold IV · 38 LP',champions:["Kog'Maw",'Aphelios','Jinx'],isPrimary:true,syncStatus:'DEMO'},
{id:'acct-alt',label:'ALT',gameName:'Kraggles',tagline:'#2304',region:'EUW',role:'ADC',rank:'Platinum IV · 12 LP',champions:['Aphelios',"Kai'Sa",'Jinx'],syncStatus:'DEMO'},
{id:'acct-jungle',label:'JUNGLE',gameName:'ClimbTest',tagline:'#EUW',region:'EUW',role:'JUNGLE',rank:'Silver I · 64 LP',champions:['Shen','Viego','Xin Zhao'],syncStatus:'DEMO'}
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
] as const;
function makeMain(r:typeof mainRows[number],i:number):Match{return {id:`main-${i+1}`,riotAccountId:'acct-main',champion:r[1],opponent:r[2],role:'ADC',result:r[0],kills:r[3],deaths:r[4],assists:r[5],durationSeconds:Math.round(r[7]*60),rank:'Gold IV',metrics:{cs:r[6],csPerMin:r[8],deaths:r[4],goldPerMin:385+i*5,damagePerMin:650+i*13,damageShare:.27+i*.004,killParticipation:.56+i*.008,objectiveParticipation:.48+i*.015,csAt10:r[9],csAt15:r[10],laneCsPerMin:r[11],post15CsPerMin:r[12],goldDiffAt15:r[13],xpDiffAt15:r[14],deathsPre10:r[15],deaths10to20:r[16],deathsPost20:r[17],soloDeaths:r[18],teamfightDeaths:r[19],firstItemMinute:r[20],secondItemMinute:r[21],levelAt15:r[14]>=0?9:8,visionScore:17+i},items:['Berserker\'s Greaves','Guinsoo\'s Rageblade','Blade of the Ruined King'],summoners:['Flash','Barrier'],source:'demo',createdAt:new Date(Date.now()-i*86400000).toISOString()}}
const main=mainRows.map(makeMain);
const alt:Match[]=main.slice(0,7).map((m,i)=>({...m,id:`alt-${i+1}`,riotAccountId:'acct-alt',champion:i%2?'Aphelios':"Kai'Sa",rank:'Platinum IV',metrics:{...m.metrics,csPerMin:+(m.metrics.csPerMin+.55).toFixed(2),laneCsPerMin:(m.metrics.laneCsPerMin||0)+.4,post15CsPerMin:(m.metrics.post15CsPerMin||0)+.6,deaths:Math.max(2,m.deaths-1)},deaths:Math.max(2,m.deaths-1)}));
const jungle:Match[]=main.slice(0,6).map((m,i)=>({...m,id:`jg-${i+1}`,riotAccountId:'acct-jungle',champion:i%3===0?'Shen':i%3===1?'Viego':'Xin Zhao',opponent:i%2?'Lee Sin':'Nocturne',role:'JUNGLE',rank:'Silver I',metrics:{...m.metrics,csPerMin:+(5.1+i*.12).toFixed(2),objectiveParticipation:.62+i*.03,killParticipation:.61+i*.025,visionScore:22+i*2}}));
export const demoMatches:Match[]=[...main,...alt,...jungle];
export const matchesFor=(accountId:string)=>demoMatches.filter(m=>m.riotAccountId===accountId);
export const missionFor=(accountId:string):Mission=> accountId==='acct-jungle'?{id:'mission-jg-1',riotAccountId:accountId,category:'OBJECTIVES',title:'OBJECTIVE TEMPO',metric:'objectiveParticipation',target:70,unit:'% objective participation',gamesRequired:3,gamesCompleted:1,successfulGames:1,rules:['Recall with enough time to be on map before neutral objectives.','Do not start low-percentage invades when an objective spawns inside 60 seconds.','Track enemy jungle side before committing to dragon or Herald.'],status:'PRACTISE',createdAt:new Date().toISOString()}:{id:`mission-${accountId}`,riotAccountId:accountId,category:'RESOURCE_COLLECTION',title:'POST-LANE ECONOMY',metric:'post15CsPerMin',target:6.0,unit:'post-15 CS/min',gamesRequired:3,gamesCompleted:2,successfulGames:1,rules:['After recall post-15, identify the next safe wave before defaulting mid.','If an objective is >60 seconds away, collect available guaranteed gold first.','Do not cross into an unsafe side lane without information on the main engage threats.'],status:'REPEAT',createdAt:new Date().toISOString()};
export const demoMission=missionFor('acct-main');
