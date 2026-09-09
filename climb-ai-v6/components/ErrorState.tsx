'use client';
import Link from 'next/link';
import {Component,ReactNode} from 'react';
import {humanError,errorKind,HumanError} from '@/lib/errors';
import {track} from '@/lib/analytics';

/**
 * Error presentation, plus a boundary for wrapping individual widgets.
 *
 * Route-level `error.tsx` catches a whole page. That is the right net for a
 * crash in the page itself, but it is far too coarse for a dashboard made of
 * independent cards: one bad computation in the chart should not take the leak
 * price, the plan and the session check down with it.
 */

export function ErrorState({error,reset,compact}:{
  error?:unknown;reset?:()=>void;compact?:boolean;
}){
  const e:HumanError=humanError(error);
  return <div className={`errstate${compact?' is-compact':''}`} role="alert">
    <div className="eyebrow">SOMETHING BROKE</div>
    <h2>{e.title}</h2>
    <p>{e.body}</p>
    <div className="errstate-actions">
      {e.retryable&&reset&&<button className="btn primary" onClick={reset}>TRY AGAIN</button>}
      {e.action&&<Link className="btn secondary" href={e.action.href}>{e.action.label}</Link>}
      {!e.retryable&&!e.action&&<Link className="btn secondary" href="/dashboard">BACK TO DEVELOPMENT HQ</Link>}
    </div>
  </div>;
}

interface BoundaryProps{children:ReactNode;label:string;compact?:boolean}
interface BoundaryState{error:unknown}

/**
 * Catches a render error in one widget and reports it, so a crash becomes a
 * single broken card with a retry rather than a white screen.
 */
export class ErrorBoundary extends Component<BoundaryProps,BoundaryState>{
  state:BoundaryState={error:null};

  static getDerivedStateFromError(error:unknown):BoundaryState{
    return {error};
  }

  componentDidCatch(error:unknown){
    // The kind, never the raw message — that can carry ids, URLs or tokens.
    track('app_error',{where:this.props.label,kind:errorKind(error)});
  }

  render(){
    if(this.state.error){
      return <div className="glass errstate-card">
        <ErrorState
          error={this.state.error}
          compact={this.props.compact}
          reset={()=>this.setState({error:null})}
        />
      </div>;
    }
    return this.props.children;
  }
}
