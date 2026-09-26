const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const bootstrap=fs.readFileSync('companion/electron/bootstrap.cjs','utf8');
const renderer=fs.readFileSync('companion/electron/renderer.js','utf8');
const pkg=JSON.parse(fs.readFileSync('companion/package.json','utf8'));
const manifest=fs.readFileSync('lib/releaseManifest.ts','utf8');

test('Restart & Update uses a silent forced relaunch',()=>{
  assert.ok(bootstrap.includes('autoUpdater.quitAndInstall(true,true)'));
  assert.ok(renderer.includes('Closing the Companion and installing the new version'));
});

test('Restart & Update has a watchdog instead of hanging forever',()=>{
  assert.ok(bootstrap.includes('installWatchdog=setTimeout'));
  assert.ok(bootstrap.includes('try{app.quit()}catch{}'));
  assert.ok(bootstrap.includes('try{app.exit(0)}catch{}'));
  assert.ok(bootstrap.includes("status:'ERROR'"));
});

test('Companion and web release manifest agree',()=>{
  assert.ok(manifest.includes(`companionVersion:'${pkg.version}'`));
});
