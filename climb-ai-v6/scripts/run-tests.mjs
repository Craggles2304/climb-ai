import {readdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// Both suffixes: the .test.cjs files are node:test suites and were silently
// excluded here, so a third of the tests never ran in npm test or in CI.
const files=readdirSync('tests').filter(file=>file.endsWith('.test.ts')||file.endsWith('.test.cjs')).sort();
const vitest=files.filter(file=>readFileSync(`tests/${file}`,'utf8').includes("from 'vitest'"));
const node=files.filter(file=>!vitest.includes(file));
const executable=process.platform==='win32'?'node.exe':'node';

function run(args){
  const result=spawnSync(executable,args,{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}

run(['--test-concurrency=1','--import','tsx','--test',...node.map(file=>`tests/${file}`)]);
if(vitest.length)run(['node_modules/vitest/vitest.mjs','run',...vitest.map(file=>`tests/${file}`),'--maxWorkers=1','--no-file-parallelism']);
