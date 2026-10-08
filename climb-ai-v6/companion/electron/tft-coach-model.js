/* OP CLIMB TFT Coach: deliberately static pre-game teaching, not live shotcalling. */
(function(root){
  'use strict';
  const STORAGE_KEY='op:tft:learning-focus:v1';
  const MISSIONS=Object.freeze([
    {id:'ECONOMY',label:'Economy',title:'ECONOMY DISCIPLINE',rule:'Make every spend part of a plan.',cues:['Think about future options','Know your spending trade-off'],review:'Did your spending follow a clear plan?',color:'gold'},
    {id:'TEMPO',label:'Tempo',title:'BOARD TEMPO',rule:'Understand strength today versus later.',cues:['Identify your strength window','Balance strength and growth'],review:'Did you recognise when strength mattered?',color:'cyan'},
    {id:'FLEX',label:'Flexibility',title:'FLEXIBLE GAME PLAN',rule:'Keep more than one path available.',cues:['Recognise flexible components','Understand commitment cost'],review:'Did you preserve realistic alternatives?',color:'violet'},
    {id:'POSITION',label:'Positioning',title:'POSITIONING BASICS',rule:'Know what each unit protects.',cues:['Identify frontline purpose','Understand carry protection'],review:'Did your formation support your game plan?',color:'pink'}
  ]);
  const GUIDES=Object.freeze([
    {id:'ECONOMY',label:'Economy',notes:[
      ['INTEREST','Saving gold can improve future spending power.'],
      ['TEMPO','Spending can improve strength but delays economy.'],
      ['LEVEL OR ROLL','Both use gold; neither is automatically correct.']
    ]},
    {id:'ITEMS',label:'Items',notes:[
      ['DAMAGE','Choose item types that match a unit’s role.'],
      ['DEFENCE','Frontline durability helps backline units contribute.'],
      ['FLEXIBILITY','Understand which item choices keep options open.']
    ]},
    {id:'COMPS',label:'Comps',notes:[
      ['FRONT-TO-BACK','A frontline creates time for ranged damage.'],
      ['REROLL','A slower-level plan seeks specific unit upgrades.'],
      ['LEVEL-FOCUSED','More team slots trade gold for board access.']
    ]}
  ]);
  function normalize(id){
    return MISSIONS.some(mission=>mission.id===id)?id:'ECONOMY';
  }
  function mission(id){return MISSIONS.find(item=>item.id===normalize(id))||MISSIONS[0]}
  function guide(id){return GUIDES.find(item=>item.id===id)||GUIDES[0]}
  const api=Object.freeze({STORAGE_KEY,MISSIONS,GUIDES,normalize,mission,guide});
  root.OP_TFT_COACH_MODEL=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
