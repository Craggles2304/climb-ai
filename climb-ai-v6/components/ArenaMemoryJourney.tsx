import {ArenaIcon} from '@/components/ArenaIcon';

const phases=[
  {number:'01',name:'MISTAKE',description:'A decision is observed.',icon:'target'},
  {number:'02',name:'PATTERN',description:'The behaviour repeats.',icon:'repeat'},
  {number:'03',name:'SCENARIO',description:'Context is remembered.',icon:'eye'},
  {number:'04',name:'LOCAL MASTERY',description:'Clean reps in familiar play.',icon:'shield'},
  {number:'05',name:'TRANSFER',description:'New champion or context.',icon:'progress'},
  {number:'06',name:'GENERALISATION',description:'A lesson works more broadly.',icon:'signal'},
  {number:'07',name:'PRINCIPLE OWNED',description:'The decision stands without cues.',icon:'trophy'},
] as const;

/** Describes how coaching memory operates. This is an explainer, not an
 * invented player progress meter; the actual proof lives in Coach Memory.
 */
export function ArenaMemoryJourney(){
 return <section className="arena-memory-journey" aria-label="How Coach Memory turns decisions into long-term learning">
   <header><span>DECISION TWIN / LEARNING ARCHITECTURE</span><h3>YOUR COACH LEARNS WITH YOU.</h3><p>Real learning takes proof across matches. These are the stages your coach checks, not automatic rewards for playing.</p></header>
   <ol>{phases.map((phase,index)=><li key={phase.number}>
      <div className="arena-memory-node"><ArenaIcon name={phase.icon} size={23}/><span>{phase.number}</span></div>
      <b>{phase.name}</b><small>{phase.description}</small>{index<phases.length-1&&<i className="arena-memory-connector" aria-hidden="true"/>}
   </li>)}</ol>
   <footer>Progress is only shown when evidence supports it. Local mastery is not the same as transfer.</footer>
 </section>;
}
