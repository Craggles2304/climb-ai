const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');

test('match-end log is classified before generic recording log',()=>{
  const source=readFileSync(path.join(process.cwd(),'companion','electron','main.cjs'),'utf8');
  const closed=source.indexOf("if(lower.includes('match recording closed'))");
  const recording=source.indexOf("if(lower.includes('recording')||lower.includes('match telemetry'))");
  assert.notEqual(closed,-1,'match recording closed branch must exist');
  assert.notEqual(recording,-1,'generic recording branch must exist');
  assert.ok(closed<recording,'match-end branch must run before the generic recording branch');
});
