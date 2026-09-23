'use client';

/**
 * Last resort: an error in the root layout itself, where providers, fonts and
 * even globals.css may not have loaded. It must therefore render its own <html>
 * and rely on nothing but inline styles.
 */
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <html lang="en">
    <body style={{
      margin:0,minHeight:'100vh',display:'grid',placeItems:'center',
      background:'#06080E',color:'#E9ECF3',
      fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif',
      padding:'24px',
    }}>
      <div style={{maxWidth:520}}>
        <div style={{
          fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',
          color:'#35D6E8',fontWeight:800,
        }}>OP CLIMB</div>
        <h1 style={{fontSize:32,letterSpacing:'-.04em',lineHeight:1.1,margin:'14px 0 12px'}}>
          The app failed to start.
        </h1>
        <p style={{color:'#8B9298',lineHeight:1.6,margin:'0 0 22px',fontSize:15}}>
          Your account and your plan are safe — nothing has been lost. This is a fault on our
          side, not something you did.
        </p>
        <button onClick={reset} style={{
          background:'linear-gradient(180deg,#F4D27E,#E3B34C 60%,#B9892C)',color:'#1A1204',border:'1px solid #E3B34C',borderRadius:0,
          padding:'13px 20px',fontWeight:800,fontSize:14,cursor:'pointer',
        }}>RELOAD</button>
        {error.digest&&<p style={{color:'#6B7278',fontSize:11,marginTop:18}}>
          Reference: {error.digest}
        </p>}
      </div>
    </body>
  </html>;
}
