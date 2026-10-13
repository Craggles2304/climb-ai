import type {ILPTask,Role} from './types';
import {ensureOneMissionPerDnaStrand} from './dnaStrandMissions';
import {canonicalGameDnaTasks,gameMissionFocusPair,gameDnaFocusSource} from './gameDnaSnapshot';
import {plainLanguageFocus} from './plainLanguageCoaching';

export type PregameMissionFocus={
  task:ILPTask;
  title:string;
  nextGame:string;
  success:string;
};
/**
 * Shared Game DNA mission decision for the Companion's pre-game plan.
 *
 * IMPORTANT: this uses exactly the same role-scoped two-tree selection as
 * /missions and /api/live/companion-home. It cannot replace that plan with
 * older generic ILP tasks, unrelated roles, or a third highest-priority task.
 * An unconfirmed pair remains a labelled suggestion.
 */
export function companionPregameMissions(
  stored:ILPTask[],
  accountId:string,
  role:Role,
):{source:'PLAYER'|'RECOMMENDED'|'UNSET';missions:PregameMissionFocus[]}{
  const strands=ensureOneMissionPerDnaStrand(stored,accountId,role).tasks;
  const scoped=canonicalGameDnaTasks(strands,role);
  const source=gameDnaFocusSource(scoped,role);
  const missions=gameMissionFocusPair(scoped,role).slice(0,2).map(({task})=>{
    const plain=plainLanguageFocus(task);
    return{
      task,
      title:String(plain.name||task.title||'Your next coaching mission').trim(),
      nextGame:String(plain.nextGame||task.gameRule||'').trim(),
      success:String(plain.success||task.target||'').trim(),
    };
  });
  return{source,missions};
}
