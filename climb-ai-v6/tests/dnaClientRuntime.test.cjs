const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dna=fs.readFileSync(path.join(__dirname,'..','public','client','dna.js'),'utf8');
const component=fs.readFileSync(path.join(__dirname,'..','components','ClientGameDna.tsx'),'utf8');

test('Game DNA canvas defines every strength helper it executes',()=>{
  assert.ok(dna.includes('const totalStrength = () =>'));
  assert.ok(dna.includes('totalStrength()'));
  const definition=dna.indexOf('const totalStrength = () =>');
  const firstUse=dna.indexOf('totalStrength()');
  assert.ok(definition>=0&&definition<firstUse,'totalStrength must be defined before the draw loop executes it');
});

test('wide Coach DNA HUD defines its percentage formatter before drawing strand strength',()=>{
  assert.ok(dna.includes('const pct = value =>'));
  assert.ok(dna.includes('ctx.fillText(pct(s), W - 14, yc)'));
  const definition=dna.indexOf('const pct = value =>');
  const firstUse=dna.indexOf('pct(s)');
  assert.ok(definition>=0&&definition<firstUse,'pct must be defined before the wide Coach canvas HUD renders');
});

test('Coach and Dashboard request the post-fix Game DNA runtime',()=>{
  assert.ok(component.includes('/client/dna.js?v=20261005b'));
});

