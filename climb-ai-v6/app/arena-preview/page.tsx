import type {Metadata} from 'next';
import Dashboard from '../dashboard/page';

export const metadata:Metadata={
  title:'Arena V2.1 — Dashboard Visual Preview',
  description:'Review the OP CLIMB Arena V2.1 premium player dashboard in a non-production preview.',
  robots:{index:false,follow:false},
};

/**
 * Public visual review route, only on the Arena V2.1 preview branch.
 *
 * Reuses the real Dashboard UI instead of rendering a disconnected mock.
 * Signed-out visitors receive the existing local demo account/data.
 * Signed-in visitors see only their own account, with normal RLS boundaries.
 */
export default function ArenaPreview(){
  return <>
    <div role="note" style={{
      position:'fixed',zIndex:9999,right:14,bottom:18,
      maxWidth:'min(350px,calc(100vw - 28px))',
      border:'1px solid #b6ff2e',borderLeft:'4px solid #b6ff2e',
      background:'rgba(10,20,30,.96)',boxShadow:'0 8px 30px #000b',
      padding:'11px 14px',fontFamily:'system-ui,sans-serif',
      fontSize:12,color:'#e9f5ff',lineHeight:1.45,pointerEvents:'none',
    }}>
      <strong style={{display:'block',fontSize:12,letterSpacing:'.07em',color:'#b6ff2e'}}>ARENA V2.1 · VISUAL PREVIEW</strong>
      Signed-out visitors see illustrative demo data. Sign in to display your own account. This is not the live production dashboard.
    </div>
    <Dashboard/>
  </>;
}
