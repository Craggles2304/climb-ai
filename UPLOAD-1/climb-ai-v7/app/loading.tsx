/**
 * Route loading state. Spec section 39: skeletons, never a blank screen.
 * Mirrors the dashboard's shape so the page does not jump when it arrives.
 */
export default function Loading(){
  return <main className="container section" aria-busy="true" aria-label="Loading">
    <div className="skeleton" style={{height:38,width:'min(340px,60%)',marginBottom:14}}/>
    <div className="skeleton" style={{height:14,width:'min(520px,80%)',marginBottom:32}}/>
    <div className="skeleton" style={{height:210,borderRadius:28,marginBottom:18}}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>
      {[0,1,2,3].map(i=><div key={i} className="skeleton" style={{height:120,borderRadius:20}}/>)}
    </div>
  </main>;
}
