const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const teamSource=fs.readFileSync(path.join(__dirname,'..','lib','champions','teamCompPlan.ts'),'utf8');
const preloadSource=fs.readFileSync(path.join(__dirname,'..','companion','electron','preload.cjs'),'utf8');
const routeSource=fs.readFileSync(path.join(__dirname,'..','app','api','live','champion-plan','route.ts'),'utf8');

test('every League role has a five-part role-specific win condition',()=>{
  for(const title of [
    'YOUR TOP WIN CONDITION',
    'YOUR JUNGLE WIN CONDITION',
    'YOUR MID WIN CONDITION',
    'YOUR ADC WIN CONDITION',
    'YOUR SUPPORT WIN CONDITION',
  ])assert.ok(teamSource.includes(title),`missing ${title}`);

  for(const role of ['TOP','JUNGLE','MID','ADC','SUPPORT']){
    assert.ok(teamSource.includes(`roleName==='${role}'`),`missing ${role} role strategy`);
  }

  for(const label of ['GET TO','PATH TOWARD','PRESSURE','ANSWER','CREATE','CONTROL','PLAY WITH','STAY WITH','SURVIVE','DAMAGE','ENABLE','SET UP','STOP','EXECUTE','CONVERT']){
    assert.ok(teamSource.includes(`'${label}'`),`missing strategy label ${label}`);
  }
});

test('paid Companion renders exactly five role-win cards and a loss condition',()=>{
  assert.ok(preloadSource.includes('opRoleStepLabel5'));
  assert.ok(preloadSource.includes('opRoleStep5'));
  assert.ok(preloadSource.includes('team?.roleWinCondition?.lossCondition'));
  assert.ok(preloadSource.includes('steps.length!==5'));
  assert.ok(preloadSource.includes('YOUR CLIMB MISSION'));
});

test('FREE never receives the paid structured role read',()=>{
  assert.ok(routeSource.includes('roleWinCondition:null'));
  assert.ok(routeSource.includes('ourWinCondition:null'));
  assert.ok(routeSource.includes('theirWinCondition:null'));
  assert.ok(routeSource.includes('biggestThrow:null'));
});

test('strategy remains frozen pre-game rather than reactive live shotcalling',()=>{
  assert.ok(routeSource.includes('snapshot:null'));
  assert.ok(routeSource.includes('must not turn'));
  assert.ok(teamSource.includes('does not react to live positioning, cooldowns or hidden information'));
});
