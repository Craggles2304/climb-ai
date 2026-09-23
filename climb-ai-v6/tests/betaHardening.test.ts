import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RELEASE_MANIFEST} from '../lib/releaseManifest';

const root=path.join(process.cwd());

test('beta release manifest matches shipped web and Companion package versions',()=>{
  const webPkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const companionPkg=JSON.parse(fs.readFileSync(path.join(root,'companion','package.json'),'utf8'));
  assert.equal(RELEASE_MANIFEST.webVersion,webPkg.version);
  assert.equal(RELEASE_MANIFEST.companionVersion,companionPkg.version);
  assert.equal(RELEASE_MANIFEST.channel,'BETA');
  assert.equal(RELEASE_MANIFEST.companionReleaseTag,'companion-beta');
});

test('Companion recovery cannot silently republish a historical hard-coded build',()=>{
  const workflow=fs.readFileSync(path.join(root,'..','.github','workflows','recover-op-climb-companion-release.yml'),'utf8');
  assert.ok(workflow.includes("jq -r '.version' climb-ai-v6/companion/package.json"));
  assert.ok(workflow.includes("--workflow 'Build OP CLIMB Companion'"));
  assert.ok(workflow.includes('--status success'));
  assert.ok(workflow.includes('feed_version'));
  assert.ok(workflow.includes('EXPECTED_VERSION'));
  assert.ok(!workflow.includes('35270825261'));
  assert.ok(!workflow.includes('version: 0.7.4'));
  assert.ok(!workflow.includes('OP CLIMB Companion 0.7.4'));
  assert.ok(!workflow.includes('push:\n'));
});

test('first-run journey sends players to Companion before manual upload',()=>{
  const firstRun=fs.readFileSync(path.join(root,'components','FirstRun.tsx'),'utf8');
  const liveIndex=firstRun.indexOf('href="/live"');
  const manualIndex=firstRun.indexOf('href="/uploads"');
  assert.ok(liveIndex>=0);
  assert.ok(manualIndex>liveIndex);
  assert.ok(firstRun.includes('SET UP COMPANION · TRACK MY FIRST GAME'));
  assert.ok(firstRun.includes('hypothesis with evidence'));
  assert.ok(!firstRun.includes('UPLOAD YOUR FIRST MATCH'));
});

test('empty Climb Session has a direct recovery path instead of a dead end',()=>{
  const session=fs.readFileSync(path.join(root,'app','session','page.tsx'),'utf8');
  assert.ok(session.includes('FIRST, GIVE THE COACH A REAL GAME'));
  assert.ok(session.includes('SET UP COMPANION →'));
  assert.ok(session.includes('href="/live"'));
  assert.ok(session.includes('ADD A GAME MANUALLY'));
});

test('beta has route-level failure, loading and not-found recovery surfaces',()=>{
  const routeError=fs.readFileSync(path.join(root,'app','error.tsx'),'utf8');
  const loading=fs.readFileSync(path.join(root,'app','loading.tsx'),'utf8');
  const notFound=fs.readFileSync(path.join(root,'app','not-found.tsx'),'utf8');
  assert.ok(routeError.includes('ErrorState'));
  assert.ok(routeError.includes('reset={reset}'));
  assert.ok(loading.includes('aria-busy="true"'));
  assert.ok(notFound.includes('BACK TO DEVELOPMENT HQ'));
});

test('Companion updater protects active League phases and shares the beta feed',()=>{
  const bootstrap=fs.readFileSync(path.join(root,'companion','electron','bootstrap.cjs'),'utf8');
  const pkg=fs.readFileSync(path.join(root,'companion','package.json'),'utf8');
  assert.ok(bootstrap.includes("new Set(['CHAMP_SELECT','RECORDING','UPLOADING'])"));
  assert.ok(bootstrap.includes('autoUpdater.autoInstallOnAppQuit=true'));
  assert.ok(bootstrap.includes('autoUpdater.allowDowngrade=false'));
  assert.ok(pkg.includes('releases/download/companion-beta'));
});

test('support-safe release manifest endpoint is no-store and Settings exposes supported versions',()=>{
  const route=fs.readFileSync(path.join(root,'app','api','release','manifest','route.ts'),'utf8');
  const settings=fs.readFileSync(path.join(root,'app','settings','page.tsx'),'utf8');
  assert.ok(route.includes("'Cache-Control':'no-store'"));
  assert.ok(route.includes('VERCEL_GIT_COMMIT_SHA'));
  assert.ok(settings.includes('BETA RELEASE'));
  assert.ok(settings.includes('RELEASE_MANIFEST.webVersion'));
  assert.ok(settings.includes('RELEASE_MANIFEST.companionVersion'));
  assert.ok(settings.includes('DOWNLOAD CURRENT COMPANION'));
});
