'use client';

import {useId,type ButtonHTMLAttributes,type CSSProperties,type HTMLAttributes,type ReactNode} from 'react';
import Link from 'next/link';
import {ArenaIcon,type ArenaIconName} from './ArenaIcon';
import type {SubscriptionTier} from '@/lib/subscription';
import s from './Arena.module.css';

const cx=(...names:Array<string|false|null|undefined>)=>names.filter(Boolean).join(' ');
const tone=(value?:string)=>(value?{'--tone':value} as CSSProperties:undefined);

export function Panel({as:Tag='section',className,pad=true,children,...rest}:{as?:'section'|'article'|'div'|'aside';className?:string;pad?:boolean;children:ReactNode}&Omit<HTMLAttributes<HTMLElement>,'children'|'className'>){
  return <Tag className={cx(s.panel,pad&&s.pad,className)} {...rest}>{children}</Tag>;
}

export function Eyebrow({children,toneColor,dot=true,className}:{children:ReactNode;toneColor?:string;dot?:boolean;className?:string}){
  return <p className={cx(s.eyebrow,className)} style={tone(toneColor)}>{dot&&<i className={s.eyebrowDot} aria-hidden="true"/>}{children}</p>;
}

/** Section heading: eyebrow, a condensed title and optional actions on the right. */
export function SectionHead({eyebrow,title,lede,aside,toneColor,titleId,level=2}:{eyebrow:ReactNode;title:ReactNode;lede?:ReactNode;aside?:ReactNode;toneColor?:string;titleId?:string;level?:2|3}){
  const Heading=level===2?'h2':'h3';
  return <div className={s.head}>
    <div className={s.headCopy}>
      <Eyebrow toneColor={toneColor}>{eyebrow}</Eyebrow>
      <Heading className={s.title} id={titleId}>{title}</Heading>
      {lede&&<p className={s.lede}>{lede}</p>}
    </div>
    {aside&&<div className={s.headAside}>{aside}</div>}
  </div>;
}

type ButtonVariant='primary'|'secondary'|'ghost';
export function ButtonLink({href,children,variant='primary',small=false,icon='arrow',className,disabled=false,onClick}:{href:string;children:ReactNode;variant?:ButtonVariant;small?:boolean;icon?:ArenaIconName|null;className?:string;disabled?:boolean;onClick?:()=>void}){
  return <Link href={href} onClick={onClick} aria-disabled={disabled||undefined} className={cx(s.btn,s[variant],small&&s.small,className)}>
    <span>{children}</span>{icon&&<ArenaIcon name={icon} size={variant==='ghost'?15:17} data-trail=""/>}
  </Link>;
}

export function Button({children,variant='secondary',small=false,icon=null,className,onClick,type='button',...rest}:{children:ReactNode;variant?:ButtonVariant;small?:boolean;icon?:ArenaIconName|null;className?:string;onClick?:()=>void;type?:'button'|'submit'}&Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'|'className'|'onClick'|'type'>){
  return <button type={type} onClick={onClick} className={cx(s.btn,s[variant],small&&s.small,className)} {...rest}>
    <span>{children}</span>{icon&&<ArenaIcon name={icon} size={17} data-trail=""/>}
  </button>;
}

export function Chip({children,toneColor,solid=false,icon,className,title}:{children:ReactNode;toneColor?:string;solid?:boolean;icon?:ArenaIconName;className?:string;title?:string}){
  return <span className={cx(s.chip,solid&&s.chipSolid,className)} style={tone(toneColor)} title={title}>{icon&&<ArenaIcon name={icon} size={13} strokeWidth={2}/>}{children}</span>;
}

/** Quiet subscription marker. Paid features read as desirable, never as a wall of locks. */
export function TierBadge({tier,label}:{tier:SubscriptionTier;label?:string}){
  return <span className={cx(s.tier,s['tier'+tier])}><i aria-hidden="true"/>{label??tier}</span>;
}

export function Stat({label,value,sub,unknown=false,className}:{label:ReactNode;value:ReactNode;sub?:ReactNode;unknown?:boolean;className?:string}){
  return <div className={cx(s.stat,className)}>
    <span className={s.statLabel} data-stat-label="">{label}</span>
    <strong className={cx(s.statValue,unknown&&s.unknown)} data-stat-value="">{value}</strong>
    {sub&&<span className={s.statSub} data-stat-sub="">{sub}</span>}
  </div>;
}

/** Evidence pips: filled only for verified games. */
export function Pips({filled,total,toneColor,label,width,height}:{filled:number;total:number;toneColor?:string;label:string;width?:number;height?:number}){
  const count=Math.max(1,Math.min(12,total));
  const on=Math.max(0,Math.min(count,filled));
  const style={...(tone(toneColor)??{}),...(width?{'--pip-w':width+'px'}:{}),...(height?{'--pip-h':height+'px'}:{})} as CSSProperties;
  return <span className={s.pips} style={style} role="img" aria-label={label}>
    {Array.from({length:count},(_,index)=><i key={index} className={cx(s.pip,index<on&&s.pipOn)}/>)}
  </span>;
}

export function Meter({value,max,toneColor,label}:{value:number;max:number;toneColor?:string;label:string}){
  const pct=max>0?Math.max(0,Math.min(100,Math.round(value/max*100))):0;
  return <div className={s.meter} style={tone(toneColor)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0,Math.min(max,value))}>
    <i className={s.meterFill} style={{width:pct+'%'}}/>
  </div>;
}

export function Skeleton({width='100%',height=14,className}:{width?:number|string;height?:number|string;className?:string}){
  return <span className={cx(s.skeleton,className)} style={{width,height}} aria-hidden="true"/>;
}

export function EmptyState({icon='spark',title,body,action,toneColor}:{icon?:ArenaIconName;title:ReactNode;body:ReactNode;action?:ReactNode;toneColor?:string}){
  return <div className={s.empty} style={tone(toneColor)}>
    <span className={s.emptyIcon}><ArenaIcon name={icon} size={19}/></span>
    <p className={s.emptyTitle}>{title}</p>
    <p className={s.emptyBody}>{body}</p>
    {action}
  </div>;
}

/** Hover or focus tooltip; the trigger is keyboard reachable and described by the tip. */
export function Tooltip({label,children}:{label:ReactNode;children:ReactNode}){
  const id=useId();
  return <span className={s.tipWrap}>
    <span className={s.tipTrigger} tabIndex={0} aria-describedby={id}>{children}</span>
    <span className={s.tip} role="tooltip" id={id}>{label}</span>
  </span>;
}

export function SampleBanner({children}:{children:ReactNode}){
  return <div className={s.sample} role="note"><ArenaIcon name="eye" size={16}/>{children}</div>;
}

export function VisuallyHidden({children}:{children:ReactNode}){
  return <span className={s.srOnly}>{children}</span>;
}

/** Arrow-key navigation for a row of role="tab" buttons (roving tabindex). */
export function handleTabKeys(event:React.KeyboardEvent,index:number,count:number,select:(next:number)=>void){
  const keys:Record<string,number>={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1};
  let next:number|null=null;
  if(event.key in keys)next=(index+keys[event.key]+count)%count;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=count-1;
  if(next===null)return;
  event.preventDefault();
  select(next);
  const tabs=(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]'))??[];
  tabs[next]?.focus();
}
