const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dna=fs.readFileSync(path.join(__dirname,'..','public','client','dna.js'),'utf8');

test('Game DNA canvas defines every strength helper it executes',()=>{
  assert.ok(dna.includes('const totalStrength = () =>'));
  assert.ok(dna.includes('totalStrength()'));
  const definition=dna.indexOf('const totalStrength = () =>');
  const firstUse=dna.indexOf('totalStrength()');
  assert.ok(definition>=0&&definition<firstUse,'totalStrength must be defined before the draw loop executes it');
});