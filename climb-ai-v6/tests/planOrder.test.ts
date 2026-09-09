import test from 'node:test';
import assert from 'node:assert/strict';
import {orderTasks,orderedTaskList,orderingNote,MIN_MEANINGFUL_GAP} from '../lib/planOrder';
import {ILPTask,Match,MatchMetrics} from '../lib/types';

let seq=0;
function task(id:string,metric:string,priority:number):ILPTask{
  return {
    id,accountId:'a',title:id,category:'FARMING',why:'',gameRule:'',metric,target:'',
    progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],priority,
    successfulGames:0,masteryRequired:3,
  };
}

function games(metric:keyof MatchMetrics,aboveWins:number,above:number,belowWins:number,below:number,
               values:[number,number]):Match[]{
  const out:Match[]=[];
  const make=(win:boolean,v:number)=>{
    seq++;
    return {
      id:`m${seq}`,riotAccountId:'a',champion:'X',role:'ADC' as const,
      result:(win?'WIN':'LOSS') as 'WIN'|'LOSS',kills:1,deaths:1,assists:1,
      durationSeconds:1900,rank:'Gold IV',
      metrics:{cs:1,csPerMin:1,deaths:1,[metric]:v} as MatchMetrics,
      source:'demo' as const,createdAt:'2026-09-01T00:00:00.000Z',
    };
  };
  for(let i=0;i<above;i++)out.push(make(i<aboveWins,values[0]));
  for(let i=0;i<below;i++)out.push(make(i<belowWins,values[1]));
  return out;
}

/** Farm separates hard (large gap); deaths barely separate (noise). */
function mixedHistory():Match[]{
  const farm=games('post15CsPerMin',10,12,3,12,[7,4]);          // ~50 point gap
  // Same games, given death values that split almost evenly.
  return farm.map((m,i)=>({...m,metrics:{...m.metrics,deathsPost20:i%2?1:4}}));
}

test('with no games the order is unchanged from the priority sort',()=>{
  const tasks=[task('low','post15CsPerMin',40),task('high','deathsPost20',90)];
  assert.deepEqual(orderedTaskList(tasks,[]).map(t=>t.id),['high','low']);
});

test('a measured cost outranks a higher priority guess',()=>{
  const tasks=[
    task('unpriceable','clipReview',95),        // no metric spec, keeps priority
    task('farm','post15CsPerMin',20),           // large measured gap
  ];
  const order=orderTasks(tasks,mixedHistory());
  assert.equal(order[0].task.id,'farm');
  assert.equal(order[0].basis,'MEASURED_COST');
  assert.equal(order[1].basis,'PRIORITY');
});

test('a noise-sized gap does not outrank a considered priority',()=>{
  const tasks=[task('deaths','deathsPost20',10),task('other','clipReview',80)];
  const order=orderTasks(tasks,mixedHistory());
  const deaths=order.find(o=>o.task.id==='deaths')!;
  assert.ok(
    deaths.price?.status!=='READY'||(deaths.price.gapPoints??0)<MIN_MEANINGFUL_GAP,
    'this fixture is meant to produce a small or unpriceable gap',
  );
  assert.equal(deaths.basis,'PRIORITY');
  assert.equal(order[0].task.id,'other','the higher priority should still lead');
});

test('measured behaviours are ordered by the size of the gap',()=>{
  const farm=games('post15CsPerMin',10,12,3,12,[7,4]);
  // Give the same games a second metric that also separates, but less.
  const both=farm.map((m,i)=>({
    ...m,metrics:{...m.metrics,secondItemMinute:m.result==='WIN'&&i%3?20:26},
  }));
  const tasks=[task('item','secondItemMinute',99),task('farm','post15CsPerMin',1)];
  const order=orderTasks(tasks,both);
  const gaps=order.filter(o=>o.basis==='MEASURED_COST').map(o=>o.price!.gapPoints!);
  assert.deepEqual([...gaps].sort((a,b)=>b-a),gaps,'measured tier must be sorted by gap descending');
});

test('an unpriceable metric is not pushed to the bottom for being unpriceable',()=>{
  const tasks=[
    task('clip','clipReview',99),
    task('setup','objectivePreparation',95),
    task('deaths','deathsPost20',5),
  ];
  const order=orderedTaskList(tasks,mixedHistory());
  assert.deepEqual(order.map(t=>t.id),['clip','setup','deaths'],'priority order preserved within the tier');
});

test('never loses or duplicates a task',()=>{
  const tasks=[
    task('a','post15CsPerMin',50),task('b','deathsPost20',50),
    task('c','clipReview',50),task('d','secondItemMinute',50),task('e','objectiveParticipation',50),
  ];
  const order=orderedTaskList(tasks,mixedHistory());
  assert.equal(order.length,tasks.length);
  assert.deepEqual(new Set(order.map(t=>t.id)),new Set(tasks.map(t=>t.id)));
});

test('ordering is deterministic',()=>{
  const tasks=[task('a','post15CsPerMin',50),task('b','deathsPost20',50),task('c','clipReview',50)];
  const history=mixedHistory();
  assert.deepEqual(
    orderedTaskList(tasks,history).map(t=>t.id),
    orderedTaskList(tasks,history).map(t=>t.id),
  );
});

test('the note says which basis was used',()=>{
  const tasks=[task('farm','post15CsPerMin',20),task('clip','clipReview',80)];
  assert.match(orderingNote(orderTasks(tasks,[])),/not enough games/i);
  assert.match(orderingNote(orderTasks(tasks,mixedHistory())),/measured cost/i);
});
