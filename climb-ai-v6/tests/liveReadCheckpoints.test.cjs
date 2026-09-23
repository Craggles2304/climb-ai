const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'companion','electron','review-v2.js'),'utf8');
const live=fs.readFileSync(path.join(root,'companion','electron','remember-v7-read-checkpoints.js'),'utf8');
const review=fs.readFileSync(path.join(root,'companion','electron','review-v3-read-calibration.js'),'utf8');
const main=fs.readFileSync(path.join(root,'companion','electron','main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'companion','electron','preload.cjs'),'utf8');
const route=fs.readFileSync(path.join(root,'app','api','live','read-checkpoint','route.ts'),'utf8');
const repoFile=fs.readFileSync(path.join(root,'lib','server','liveTrackerRepository.ts'),'utf8');
const graph=fs.readFileSync(path.join(root,'lib','decisionGraph.ts'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));

test('Stage 10 loads after Match OS and before the player uses the checkpoint UI',()=>{
  assert.ok(loader.includes("load('remember-v6-match-os.js')"));
  assert.ok(loader.includes("load('remember-v7-read-checkpoints.js')"));
  assert.ok(loader.indexOf('remember-v7-read-checkpoints.js')>loader.indexOf('remember-v6-match-os.js'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);assert.ok(major>0||minor>7||(minor===7&&patch>=38));
});

test('live checkpoints freeze player reads at 5 10 and 15 without revealing an answer',()=>{
  assert.ok(live.includes("const CHECKPOINTS=[5,10,15]"));
  assert.ok(live.includes('LIVE READ CHECK · NO ANSWER REVEALED'));
  assert.ok(live.includes('WHAT STATE ARE WE IN?'));
  assert.ok(live.includes('HOW SURE ARE YOU?'));
  assert.ok(live.includes('WHAT IS YOUR NEXT PRIORITY?'));
  assert.ok(live.includes("STATE_OPTIONS=['AHEAD','EVEN','BEHIND']"));
  assert.ok(!live.includes('YOU_STRONGER'));
  assert.ok(!live.includes('THEM_STRONGER'));
});

test('checkpoint reads persist locally and sync through the authenticated desktop bridge',()=>{
  assert.ok(live.includes('readCheckpoints'));
  assert.ok(live.includes("source:'PLAYER_CHECKPOINT'"));
  assert.ok(live.includes('recordReadCheckpoint'));
  assert.ok(preload.includes("recordReadCheckpoint:(context)=>ipcRenderer.invoke('companion:read-checkpoint',context)"));
  assert.ok(main.includes("ipcMain.handle('companion:read-checkpoint'"));
  assert.ok(main.includes('/api/live/read-checkpoint'));
  assert.ok(route.includes('authenticateTrackerToken'));
  assert.ok(route.includes('recordLiveReadCheckpoint'));
  assert.ok(repoFile.includes("from('live_player_read_checkpoints')"));
});

test('Decision Graph owns the post-game read calibration evidence',()=>{
  assert.ok(graph.includes('buildGameReadCalibration'));
  assert.ok(graph.includes('readCalibration:GameReadCalibrationReview'));
  assert.ok(graph.includes('readCheckpoints?:LiveReadCheckpoint[]'));
  assert.ok(repoFile.includes('readCheckpointsForSession'));
  assert.ok(repoFile.includes('readCheckpoints})'));
});

test('post-game Companion renders state accuracy and confidence calibration',()=>{
  assert.ok(loader.includes("load('review-v3-read-calibration.js')"));
  assert.ok(review.includes('GAME READ · CALIBRATION'));
  assert.ok(review.includes('HIGH-CONFIDENCE ERRORS'));
  assert.ok(review.includes('LOW-CONFIDENCE CORRECT'));
  assert.ok(review.includes('NEXT READ FOCUS'));
  assert.ok(review.includes('readCalibration'));
});
