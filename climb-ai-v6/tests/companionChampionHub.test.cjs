const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {championRoster,championGuide}=require('../companion/electron/champion-hub-data.cjs');

function response(body,status=200){return{ok:status>=200&&status<300,status,async json(){return body}}}

test('Companion uses the website champion roster and guide sources',async()=>{
  const calls=[];
  const fetchImpl=async url=>{
    const parsed=new URL(url);calls.push(parsed);
    if(parsed.pathname==='/api/champions/main')return response({ok:true,patch:'26.19.1',names:['Ahri','Jinx']});
    if(parsed.pathname==='/api/champions')return response({ok:true,patch:'26.19.1',profile:{id:'Jinx',name:'Jinx',lanePlan:['Farm safely.'],spikes:[{level:6,title:'Ultimate'}]}});
    if(parsed.pathname==='/api/champions/main/meta')return response({ok:true,patch:'26.19',runePage:{perks:[{id:1,name:'Lethal Tempo',icon:'https://ddragon.leagueoflegends.com/rune.png'}]},skillPriority:['Q','W','E']});
    if(parsed.pathname==='/api/champions/main/popular')return response({ok:true,patch:'26.19',items:[{id:1,name:'Infinity Edge'}]});
    throw new Error('unexpected route');
  };
  const roster=await championRoster('https://opclimb.com',fetchImpl,true);
  const guide=await championGuide('https://opclimb.com','Jinx','ADC',fetchImpl,true);
  assert.deepEqual(roster.names,['Ahri','Jinx']);
  assert.equal(guide.profile.profile.name,'Jinx');
  assert.equal(guide.meta.runePage.perks[0].name,'Lethal Tempo');
  assert.equal(guide.build.items[0].name,'Infinity Edge');
  assert.deepEqual(calls.map(call=>call.pathname),['/api/champions/main','/api/champions','/api/champions/main/meta','/api/champions/main/popular']);
  assert.ok(calls.slice(1).every(call=>call.searchParams.get('champion')==='Jinx'));
  assert.ok(calls.slice(2).every(call=>call.searchParams.get('role')==='ADC'));
});

test('missing current meta data does not hide the champion plan and build',async()=>{
  const fetchImpl=async url=>{
    const path=new URL(url).pathname;
    if(path==='/api/champions')return response({ok:true,patch:'26.19.1',profile:{id:'Jinx',name:'Jinx',lanePlan:['Farm safely.']}});
    if(path.endsWith('/meta'))return response({ok:false,error:'Meta unavailable'},503);
    return response({ok:true,items:[{id:1,name:'Infinity Edge'}]});
  };
  const guide=await championGuide('https://opclimb.com','Jinx','ADC',fetchImpl,true);
  assert.equal(guide.ok,true);
  assert.equal(guide.meta,null);
  assert.equal(guide.errors.meta,'Meta unavailable');
  assert.equal(guide.build.items.length,1);
});

test('waiting page gives way to the live match phases',()=>{
  const source=fs.readFileSync('companion/electron/champion-hub.js','utf8');
  const arena=fs.readFileSync('companion/electron/arena.js','utf8');
  assert.ok(source.includes("state.phase==='WAITING'"));
  assert.ok(arena.includes("phase!=='WAITING'"));
  assert.ok(source.includes("openClimbPath('/champions/main')"));
});
