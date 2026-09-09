'use client';
import {useEffect,useRef,useState} from 'react';

/**
 * Motion primitives. Three rules:
 *  - every animation is skipped outright under prefers-reduced-motion
 *  - the final value is always rendered, so nothing depends on JS to be readable
 *  - no animation library; this is a few hundred bytes of rAF
 */

export function usePrefersReducedMotion(){
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{
    const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange=()=>setReduced(mq.matches);
    mq.addEventListener('change',onChange);
    return ()=>mq.removeEventListener('change',onChange);
  },[]);
  return reduced;
}

const easeOut=(t:number)=>1-Math.pow(1-t,3);

/**
 * True once the component has mounted on the client. Used to add `.reveal.in`
 * to an existing element rather than wrapping it, so entrance animation never
 * introduces a new box into a grid and changes the layout.
 */
export function useMounted(){
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{
    const id=requestAnimationFrame(()=>setMounted(true));
    return ()=>cancelAnimationFrame(id);
  },[]);
  return mounted;
}

/** `className` + staggered `style` for a revealed list item. */
export function revealProps(mounted:boolean,index=0,base=''){
  return {
    className:`${base} reveal${mounted?' in':''}`.trim(),
    style:{transitionDelay:`${index*60}ms`},
  };
}

/** Counts from 0 to `value`. Renders the true value immediately if motion is reduced. */
export function CountUp({value,duration=900,decimals=0,suffix=''}:{
  value:number;duration?:number;decimals?:number;suffix?:string;
}){
  const reduced=usePrefersReducedMotion();
  const [shown,setShown]=useState(value);
  const frame=useRef<number|undefined>(undefined);

  useEffect(()=>{
    if(reduced){setShown(value);return}
    const start=performance.now();
    const from=0;
    const step=(now:number)=>{
      const t=Math.min(1,(now-start)/duration);
      setShown(from+(value-from)*easeOut(t));
      if(t<1)frame.current=requestAnimationFrame(step);
    };
    frame.current=requestAnimationFrame(step);
    return ()=>{if(frame.current)cancelAnimationFrame(frame.current)};
  },[value,duration,reduced]);

  return <>{shown.toFixed(decimals)}{suffix}</>;
}

/** Fades and lifts children in once, on mount. `delay` staggers a list. */
export function Reveal({children,delay=0,className}:{
  children:React.ReactNode;delay?:number;className?:string;
}){
  const reduced=usePrefersReducedMotion();
  const [shown,setShown]=useState(false);
  useEffect(()=>{
    if(reduced){setShown(true);return}
    const id=setTimeout(()=>setShown(true),delay);
    return ()=>clearTimeout(id);
  },[delay,reduced]);
  return <div className={`reveal${shown?' in':''}${className?` ${className}`:''}`}>{children}</div>;
}

/** Progress bar that grows to `value` on mount. Same markup contract as ProgressBar. */
export function AnimatedBar({value,delay=0}:{value:number;delay?:number}){
  const reduced=usePrefersReducedMotion();
  const target=Math.max(0,Math.min(100,value));
  const [width,setWidth]=useState(reduced?target:0);
  useEffect(()=>{
    if(reduced){setWidth(target);return}
    const id=setTimeout(()=>setWidth(target),delay+40);
    return ()=>clearTimeout(id);
  },[target,delay,reduced]);
  return <div className="progress" role="progressbar" aria-valuenow={Math.round(target)} aria-valuemin={0} aria-valuemax={100}>
    <i style={{width:`${width}%`,transition:reduced?'none':'width .9s cubic-bezier(.22,1,.36,1)'}}/>
  </div>;
}

/** Conic progress ring that sweeps to `value` on mount. */
export function AnimatedRing({value,label,decimals=0}:{value:number;label:string;decimals?:number}){
  const reduced=usePrefersReducedMotion();
  const target=Math.max(0,Math.min(100,value));
  const [pct,setPct]=useState(reduced?target:0);
  useEffect(()=>{
    if(reduced){setPct(target);return}
    const id=setTimeout(()=>setPct(target),60);
    return ()=>clearTimeout(id);
  },[target,reduced]);
  return <div className="v7-ring" style={{
    '--pct':pct,
    transition:reduced?'none':'--pct 1.1s cubic-bezier(.22,1,.36,1)',
  } as React.CSSProperties}>
    <div>
      <strong>{reduced?target.toFixed(decimals):<CountUp value={target} decimals={decimals}/>}</strong>
      <span>{label}</span>
    </div>
  </div>;
}
