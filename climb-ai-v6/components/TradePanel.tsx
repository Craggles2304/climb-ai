'use client';
import type {TradeReport,TradeVerdict} from '@/lib/combat/trades';

/**
 * Trade scenarios, shortest to longest.
 *
 * The flip sentence sits ABOVE the table rather than under it. It is the part
 * most likely to change how someone plays the lane, and a table of five
 * percentages does not say "take it and leave" on its own.
 */

const VERDICT_CLASS:Record<TradeVerdict,string>={
  YOU:'edge-you',THEM:'edge-them',EVEN:'edge-even',
};

export function TradePanel({report,you,them}:{
  report:TradeReport;you:string;them:string;
}){
  return <div className="glass card" style={{marginTop:16}}>
    <div className="eyebrow">TRADE SCENARIOS</div>
    <h2>Who wins, and for how long</h2>

    {report.flip&&<div className="trade-flip">{report.flip}</div>}

    <div style={{overflowX:'auto',marginTop:14}}>
      <table className="table">
        <thead><tr>
          <th>Scenario</th><th>{you}</th><th>{them}</th><th>Margin</th><th>Verdict</th>
        </tr></thead>
        <tbody>{report.outcomes.map(outcome=>
          <tr key={outcome.scenario.key}>
            <td>{outcome.scenario.label}</td>
            <td>{outcome.you.healthSharePercent}%</td>
            <td>{outcome.them.healthSharePercent}%</td>
            <td>{outcome.marginPoints>0?'+':''}{outcome.marginPoints}</td>
            <td>
              <span className={`edge-tag ${VERDICT_CLASS[outcome.verdict]}`}>
                {outcome.verdict}
              </span>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <p className="muted" style={{marginTop:12,fontSize:12}}>
      Damage is compared as a share of the other champion&rsquo;s health, because the
      same number means different things to different health bars.
    </p>
    <p className="muted" style={{marginTop:8,fontSize:12}}>{report.modelNote}</p>
  </div>;
}
