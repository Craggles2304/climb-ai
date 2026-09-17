const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','companion','src','main.mjs'),'utf8');

test('champ select keeps explicit role and falls back to Smite for jungle',()=>{
  assert.match(source,/function champSelectRole\(raw\)/);
  assert.match(source,/const explicit=canonicalRole\(text\(raw\?\.assignedPosition\)\|\|text\(raw\?\.position\)\)/);
  assert.match(source,/spell1===11\|\|spell2===11\)return'JUNGLE'/);
  assert.match(source,/role:champSelectRole\(raw\)\|\|null/);
  assert.match(source,/localRole:champSelectRole\(localRaw\)\|\|null/);
});
