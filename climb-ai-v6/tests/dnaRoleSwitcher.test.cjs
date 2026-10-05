const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const switcher=fs.readFileSync(path.join(root,'components','DnaRoleSwitcher.tsx'),'utf8');
const coach=fs.readFileSync(path.join(root,'app','coach','page.tsx'),'utf8');
const ilp=fs.readFileSync(path.join(root,'app','ilp','page.tsx'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'app','dashboard','page.tsx'),'utf8');
const api=fs.readFileSync(path.join(root,'app','api','live','companion-home','route.ts'),'utf8');
const main=fs.readFileSync(path.join(root,'companion','electron','main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'companion','electron','preload.cjs'),'utf8');
const renderer=fs.readFileSync(path.join(root,'companion','electron','renderer.js'),'utf8');

test('web DNA role switcher is viewing-only and covers all five League roles',()=>{
  assert.ok(switcher.includes('LEAGUE_ROLES.map'));
  assert.ok(switcher.includes('Viewing only. Switching role here never merges XP, missions or history.'));
  assert.ok(switcher.includes('primaryRole'));
});

test('Game DNA and My Climb derive DNA from the selected role without changing the account role',()=>{
  const gameDna=fs.readFileSync(path.join(root,'app','game-dna','page.tsx'),'utf8');
  assert.ok(gameDna.includes('const [viewRole,setViewRole]'));
  assert.ok(gameDna.includes('taskAppliesToRole(task,viewRole)'));
  assert.ok(gameDna.includes('<DnaRoleSwitcher'));
  assert.ok(coach.includes('href="/game-dna"'));
  assert.ok(ilp.includes('const [viewRole,setViewRole]'));
  assert.ok(ilp.includes('taskAppliesToRole(task,viewRole)'));
  assert.ok(ilp.includes('<DnaRoleSwitcher role={viewRole}'));
  assert.ok(!switcher.includes('setActive('));
});

test('dashboard Game DNA can flick between role profiles independently',()=>{
  assert.ok(dashboard.includes('const [dnaRole,setDnaRole]'));
  assert.ok(dashboard.includes('<DnaRoleSwitcher compact role={dnaRole}'));
  assert.ok(dashboard.includes('gameDnaClientMissions(dnaRoleTasks,dnaRole)'));
});

test('Companion can browse a selected role only while idle',()=>{
  assert.ok(api.includes("req.nextUrl.searchParams.get('role')"));
  assert.ok(api.includes('roleProfiles:LEAGUE_ROLES.map'));
  assert.ok(main.includes("ipcMain.handle('companion:set-dna-role'"));
  assert.ok(main.includes("state.phase!=='WAITING'"));
  assert.ok(preload.includes("setDnaRole:(role)=>ipcRenderer.invoke('companion:set-dna-role',role)"));
  assert.ok(renderer.includes("id=\"playerDnaRoleSwitcher\""));
  assert.ok(renderer.includes('window.opCompanion.setDnaRole(role)'));
});