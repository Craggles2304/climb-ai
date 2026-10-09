'use client';

export function ArenaSparkline({points,label,color}:{points:number[];label:string;color:string}){
  const data=points.filter(v=>Number.isFinite(v));
  if(data.length<2)return <span className="arena-original-trend-empty">NO TREND YET</span>;
  const low=Math.min(...data),span=Math.max(1,Math.max(...data)-low);
  const pts=data.map((v,i)=>({x:8+i*184/(data.length-1),y:40-(v-low)/span*29}));
  const line=pts.map((pt,i)=>(i?'L':'M')+pt.x.toFixed(1)+' '+pt.y.toFixed(1)).join(' ');
  const area=line+' L '+pts[pts.length-1].x.toFixed(1)+' 48 L 8 48 Z';
  return <svg className="arena-original-spark" viewBox="0 0 200 55" role="img" aria-label={label} preserveAspectRatio="none">
    <path d="M8 47H192" stroke="#7594a429" strokeWidth="1" fill="none"/>
    <path d={area} fill={color} opacity=".11"/>
    <path d={line} stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke"/>
    <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="3" fill={color} stroke="#13202c" strokeWidth="2"/>
  </svg>;
}
