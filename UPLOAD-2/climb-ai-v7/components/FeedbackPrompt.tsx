'use client';
import {useState,useEffect,useRef} from 'react';
import {anonId,sessionId,track} from '@/lib/analytics';
import {FEEDBACK_REASON_LABELS,FeedbackSurface} from '@/lib/feedback';

/**
 * "Was this useful?" on a specific claim.
 *
 * Rules it follows, because a nagging feedback widget teaches people to ignore
 * feedback widgets:
 *  - asks once per subject, then remembers the answer locally and stays quiet
 *  - only asks for a reason after a NO, and never blocks on it
 *  - never blocks the UI; a failed submit thanks the user anyway, because the
 *    person who told us the diagnosis was wrong should not see an error
 */

export type Surface=FeedbackSurface;

const key=(surface:string,subject:string)=>`op_fb_${surface}_${subject}`;

export function FeedbackPrompt({surface,subject,rankBand,role,question='Was this useful?'}:{
  surface:Surface;subject:string;rankBand?:string;role?:string;question?:string;
}){
  const [answered,setAnswered]=useState<boolean|null>(null);
  const [done,setDone]=useState(false);
  const [hidden,setHidden]=useState(true);

  useEffect(()=>{
    try{setHidden(!!window.localStorage.getItem(key(surface,subject)))}catch{setHidden(false)}
  },[surface,subject]);

  const remember=(value:string)=>{
    try{window.localStorage.setItem(key(surface,subject),value)}catch{/* private mode */}
  };

  // One submission per prompt. Clicking No and then a reason must not write two
  // rows, or every negative gets counted twice in the corpus.
  const sent=useRef(false);
  const send=async(useful:boolean,reason?:string)=>{
    if(sent.current)return;
    sent.current=true;
    track('feedback_given',{surface,subject,useful,reason:reason??null});
    try{
      await fetch('/api/feedback',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({anonId:anonId(),sessionId:sessionId(),useful,surface,subject,reason,rankBand,role}),
        keepalive:true,
      });
    }catch{/* the answer is already banked locally; never surface this */}
  };

  // A "No" with no reason yet is still the signal worth having, so it is
  // submitted if the player navigates away or closes the tab mid-question.
  const pending=useRef(false);
  pending.current=answered===false&&!done;
  useEffect(()=>{
    const finish=()=>{if(pending.current)void send(false)};
    window.addEventListener('pagehide',finish);
    return ()=>{window.removeEventListener('pagehide',finish);finish()};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if(hidden)return null;

  if(done){
    return <div className="fb" role="status">
      <span className="fb-thanks">Logged. This is how the diagnosis gets better.</span>
    </div>;
  }

  if(answered===false){
    return <div className="fb">
      <span className="fb-q">What was wrong?</span>
      <div className="fb-reasons">
        {FEEDBACK_REASON_LABELS.map(([value,label])=>(
          <button key={value} className="fb-chip" onClick={()=>{
            void send(false,value);remember(`no:${value}`);setDone(true);
          }}>{label}</button>
        ))}
        <button className="fb-skip" onClick={()=>{remember('no');setDone(true)}}>Skip</button>
      </div>
    </div>;
  }

  return <div className="fb">
    <span className="fb-q">{question}</span>
    <div className="fb-actions">
      <button className="fb-btn" onClick={()=>{void send(true);remember('yes');setDone(true)}}>Yes</button>
      <button className="fb-btn" onClick={()=>setAnswered(false)}>No</button>
    </div>
  </div>;
}
