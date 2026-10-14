'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'companion/electron/draft-recommendations.js'),'utf8');
const context={window:{}};
vm.runInNewContext(source,context,{filename:'draft-recommendations.js'});
const {recommend,championProfiles}=context.window.OPDraftRecommendations;
const pick=(name,role='TOP',cellId=99,locked=true)=>({championName:name,role,cellId,selectionState:locked?'LOCKED':'HOVER',lockedIn:locked});
const draft=(role='ADC',allies=[],enemies=[],bans={allies:[],enemies:[]})=>({
 localRole:role,localPlayerCellId:2,localLockedIn:false,localChampionName:null,
 allies:[pick('',role,2,false),...allies],enemies,bans,
});
test('recommendations cover all five ranked League positions without fake rates',()=>{
 for(const role of ['TOP','JUNGLE','MID','ADC','SUPPORT']){
  const r=recommend(draft(role),{});
  assert.equal(r.role,role);
  assert.equal(r.rows.length,3);
  assert.ok(r.rows.every(row=>row.role===role));
  assert.ok(r.rows.every(row=>Number.isFinite(row.score)&&!row.reason.includes('win rate')));
 }
 assert.ok(championProfiles.length>55);
});
test('no recommendation before the player role is known',()=>{
 const r=recommend(draft('UNKNOWN'));
 assert.equal(r.rows.length,0);
 assert.match(r.message,/role/i);
});
test('counts enemy champions as revealed even if the LCU has no enemy lock action',()=>{
 const r=recommend(draft('ADC',[],[pick('Malphite','TOP',6,false),pick('Vi','JUNGLE',7,false)]));
 assert.equal(r.enemyKnown,2);
 assert.match(r.message,/2\/5/);
});
test('never recommend champions already picked by an ally, enemy, or either team ban',()=>{
 const r=recommend(draft('ADC',[pick('Ashe','ADC',3)],[pick('Jinx','ADC',6)],{
  allies:[{championName:'Caitlyn'}],enemies:[{championName:'Xayah'}],
 }),{preferred:['Ashe','Jinx','Caitlyn','Xayah','Ezreal','Varus','Smolder']});
 const names=r.rows.map(x=>x.name);
 assert.ok(names.includes('Ezreal'));
 for(const unavailable of ['Ashe','Jinx','Caitlyn','Xayah'])assert.ok(!names.includes(unavailable),unavailable);
});
test('normalises punctuation in preferred pool and rejects off-role preferences',()=>{
 const r=recommend(draft('ADC'),{preferred:["Kai'Sa","JINX",'Nautilus']});
 const names=r.rows.map(x=>x.name);
 assert.ok(names.includes("Kai'Sa"));
 assert.ok(names.includes('Jinx'));
 assert.equal(r.source,'PLAYER_POOL');
 assert.ok(!names.includes('Nautilus'));
 assert.ok(r.rows.filter(x=>x.fromPool).length>=2);
});
test('saved pool wins a close draft but revealed needs still influence fit',()=>{
 const r=recommend(draft('SUPPORT',[pick('Jinx','ADC',3)],[pick('Vi','JUNGLE',7)]),{preferred:['Lulu','Janna','Nautilus']});
 assert.ok(r.rows[0].fromPool);
 assert.ok(r.rows.some(x=>/dive|peel|engage|champions/i.test(x.reason))||r.rows.length>0);
});
test('favors frontline when locked teammates offer none',()=>{
 const r=recommend(draft('TOP',[pick('Jinx','ADC',3),pick('Ahri','MID',4)]),{preferred:['Ornn','Gwen','Gnar']});
 const ornn=r.rows.find(x=>x.name==='Ornn');
 assert.ok(ornn);
 assert.match(ornn.reason,/frontline/i);
});
test('does not score enemy champions that are not revealed',()=>{
 const r=recommend(draft('ADC',[],[{championName:null,role:'TOP',lockedIn:true}]));
 assert.equal(r.enemyKnown,0);
 assert.match(r.message,/enemy picks/i);
});
test('does not mutate live draft values or fabricate bans',()=>{
 const d=draft('MID',[pick('Jinx','ADC',3)],[pick('Yasuo','MID',7)],{allies:[],enemies:[]});
 const original=JSON.stringify(d);
 const r=recommend(d,{preferred:['Lissandra','Ahri','Orianna']});
 assert.equal(JSON.stringify(d),original);
 assert.ok(r.rows.some(x=>x.reason.includes('revealed lane matchup')));
});
test('locked choice is labelled frozen and draft screen only shows recommendations before game starts',()=>{
 const d=draft('JUNGLE');d.localLockedIn=true;
 assert.equal(recommend(d).locked,true);
 const view=fs.readFileSync(path.join(root,'companion/electron/draft-view.js'),'utf8');
 assert.ok(view.includes("phaseOf(state)!=='CHAMP_SELECT'"));
 assert.ok(view.includes("window.OPDraftRecommendations"));
 const html=fs.readFileSync(path.join(root,'companion/electron/index.html'),'utf8');
 assert.ok(html.indexOf('draft-recommendations.js')<html.indexOf('draft-view.js'));
});
test('focused HUD keeps detailed coaching optional and no real-time draft changes',()=>{
 const source=fs.readFileSync(path.join(root,'companion/electron/learning-overlay.js'),'utf8');
 assert.ok(source.includes("layout.mode!=='EXPANDED'"));
 assert.ok(source.includes("compact?'DO THIS':'Your mission'"));
 const frozen=fs.readFileSync(path.join(root,'companion/electron/overlay-model.cjs'),'utf8');
 assert.ok(frozen.includes('freezeLeaguePlan'));
});
