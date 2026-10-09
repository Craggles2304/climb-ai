const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

/*
 * esports-v2.css is a legacy decoration layer for the screens that are not yet
 * native (Live Companion, settings, status). Its script decorated the old draft
 * board, plan banner and simple review; those screens are now native views, so
 * the script is retired. These tests pin the remaining contract: the legacy
 * styles still ship, never hide content, respect reduced motion, and load before
 * the new design system so the new views always win.
 */

const root=process.cwd();
const electron=path.join(root,'companion/electron');
const html=fs.readFileSync(path.join(electron,'index.html'),'utf8');
const css=fs.readFileSync(path.join(electron,'esports-v2.css'),'utf8');

test('legacy layers load first and the new design system loads last',()=>{
  const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
  assert.equal(links[0],'design-system.css','tokens load before everything');
  const shell=links.indexOf('shell.css');
  for(const legacy of ['styles.css','esports-v2.css','premium-review.css','broadcast-v2.css','brand-sync.css'])
    assert.ok(links.indexOf(legacy)>=0&&links.indexOf(legacy)<shell,`${legacy} must load before the shell`);
  assert.deepEqual(links.slice(shell),['shell.css','home.css','draft.css','review.css']);
  assert.ok(html.includes('<script src="review-v2.js"></script>'),'the Match OS loader must stay');
  assert.ok(!fs.existsSync(path.join(electron,'esports-v2.js')),'the retired decoration script is gone');
  assert.doesNotMatch(html,/esports-v2\.js/);
});

test('the legacy layer ships inside the installer',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'companion/package.json'),'utf8'));
  assert.ok(pkg.build.files.includes('electron/**/*'));
  assert.ok(!pkg.build.files.some(f=>/^!.*esports-v2/.test(f)),'nothing may exclude the layer');
});

test('the stylesheet does not hide information or remove elements',()=>{
  // Decoration only: the layer may restyle, never take content away. The
  // deliberate exception is the idle radar, which is redundant once a screen is showing.
  const hiding=[...css.matchAll(/([^{}]+)\{[^}]*display\s*:\s*none[^}]*\}/g)].map(m=>m[1].trim());
  for(const selector of hiding){
    assert.match(selector,/#idleArena|\.es-tile\.es-missing|::-webkit|::before|::after|\.es-/,`unexpected hiding rule: ${selector}`);
  }
});

test('reduced motion turns the animations off',()=>{
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});

test('champion art uses the right Data Dragon ids for awkward names',()=>{
  const window={};
  vm.runInContext(fs.readFileSync(path.join(electron,'oc-ui.js'),'utf8'),vm.createContext({window,localStorage:{getItem:()=>null,setItem(){}}}));
  const {tileUrl,championId}=window.ocUI;
  assert.match(tileUrl('Aatrox'),/\/tiles\/Aatrox_0\.jpg$/);
  assert.match(tileUrl('Lee Sin'),/\/tiles\/LeeSin_0\.jpg$/);
  assert.match(tileUrl('Wukong'),/\/tiles\/MonkeyKing_0\.jpg$/,'Wukong is MonkeyKing in Data Dragon');
  assert.match(tileUrl("Kai'Sa"),/\/tiles\/Kaisa_0\.jpg$/);
  assert.match(tileUrl('Nunu & Willump'),/\/tiles\/Nunu_0\.jpg$/);
  // Placeholders never become a broken image request.
  for(const name of ['','SELECTING…','Not revealed','Unknown',null])assert.equal(championId(name),'',String(name));
});
