import type {SVGProps} from 'react';

/**
 * OP CLIMB Arena icon set. 24px grid, 1.75 stroke, round joins, drawn for this
 * product; every icon inherits currentColor so it takes the tone of its context.
 */
const PATHS={
  home:<><path d="M4 11.2 12 4l8 7.2"/><path d="M6.5 9.6V20h4v-5h3v5h4V9.6"/></>,
  dna:<><path d="M8 3c0 6 8 6 8 12s-8 6-8 6"/><path d="M16 3c0 6-8 6-8 12"/><path d="M16 21c0-2-.6-3.4-1.6-4.5"/><path d="M9 6.5h6M8.6 12h6.8M9 17.5h6"/></>,
  climb:<><path d="M3 19h18"/><path d="m4 16 5-6 4 3 6-8"/><path d="M15 5h4v4"/></>,
  missions:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
  match:<><path d="M5 4l9 9M4 5l1-1M9 17l-3 3-2-2 3-3"/><path d="M19 4l-9 9M20 5l-1-1M15 17l3 3 2-2-3-3"/></>,
  games:<><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/></>,
  coach:<><path d="M5 18.5V6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4a2.8 2.8 0 0 1-2.8 2.8H9.2z"/><path d="M9 9h6M9 12h3.5"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></>,
  account:<><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/></>,
  help:<><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><path d="M12 17h.01"/></>,
  arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
  chevron:<><path d="m9 6 6 6-6 6"/></>,
  external:<><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></>,
  check:<><path d="m5 12.5 4.2 4.2L19 7"/></>,
  cross:<><path d="M6 6l12 12M18 6 6 18"/></>,
  lock:<><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></>,
  eye:<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></>,
  pulse:<><path d="M3 12h4l2.5-6 4 12 2.5-6H21"/></>,
  spark:<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></>,
  shield:<><path d="M12 3 19 6v5.5c0 4.6-3 7.8-7 9.5-4-1.7-7-4.9-7-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/></>,
  memory:<><path d="M9 4.5a3 3 0 0 0-3 3v.3A3 3 0 0 0 4.5 13a3 3 0 0 0 2 4.6A3 3 0 0 0 12 19V5.5A1.9 1.9 0 0 0 9 4.5z"/><path d="M15 4.5a3 3 0 0 1 3 3v.3A3 3 0 0 1 19.5 13a3 3 0 0 1-2 4.6A3 3 0 0 1 12 19"/></>,
  transfer:<><path d="M4 8h12M12 4l4 4-4 4"/><path d="M20 16H8M12 12l-4 4 4 4"/></>,
  clock:<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  link:<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>,
  hex:<><path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/></>,
  sword:<><path d="M14.5 4H20v5.5L10 19.5 4.5 14z"/><path d="m7 16.5-3 3M8.5 12.5l3 3"/></>,
  menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,
  sync:<><path d="M20 7.5A8.5 8.5 0 0 0 5 6.6L3.5 8"/><path d="M3.5 3.5V8H8"/><path d="M4 16.5A8.5 8.5 0 0 0 19 17.4l1.5-1.4"/><path d="M20.5 20.5V16H16"/></>,
  /* Roles: a minimap square with the role's lane drawn strong. */
  roleTop:<><rect x="4" y="4" width="16" height="16" rx="2.5" opacity=".35"/><path d="M5.5 14V5.5H14" strokeWidth="2.6"/></>,
  roleMid:<><rect x="4" y="4" width="16" height="16" rx="2.5" opacity=".35"/><path d="M7 17 17 7" strokeWidth="2.6"/></>,
  roleBot:<><rect x="4" y="4" width="16" height="16" rx="2.5" opacity=".35"/><path d="M10 18.5h8.5V10" strokeWidth="2.6"/></>,
  roleJungle:<><path d="M12 3.5c-3.5 3-5 6.2-5 9.4A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1c0-3.2-1.5-6.4-5-9.4z"/><path d="M12 9v11.5"/><path d="m12 13.5-2.6-2.1M12 15.8l2.6-2.1"/></>,
  roleSupport:<><path d="M12 3.5 18.5 6v5.2c0 4.3-2.7 7.3-6.5 9.3-3.8-2-6.5-5-6.5-9.3V6z"/><path d="M12 8.5v7M8.5 12h7"/></>,
  /* Game DNA strands */
  laning:<><path d="M4 20 20 4"/><path d="M4 13.5 10.5 20"/><path d="M13.5 4 20 10.5"/></>,
  waves:<><path d="M3 9c2.2 0 2.2-2.5 4.5-2.5S9.8 9 12 9s2.2-2.5 4.5-2.5S18.8 9 21 9"/><path d="M3 15c2.2 0 2.2-2.5 4.5-2.5S9.8 15 12 15s2.2-2.5 4.5-2.5S18.8 15 21 15"/><path d="M7 19.5h10"/></>,
  vision:<><path d="M12 3.5 7.5 13a4.5 4.5 0 0 0 9 0z"/><path d="M12 20.5v-3"/><path d="M8 20.5h8"/></>,
  objectives:<><path d="M5 20V4.5"/><path d="M5 5h10.5l-2 3.5 2 3.5H5"/><circle cx="17.5" cy="18" r="2.5"/></>,
  teamfights:<><circle cx="8.5" cy="9" r="3"/><circle cx="15.5" cy="9" r="3"/><path d="M3.5 19c.6-3 2.6-4.7 5-4.7 1.4 0 2.6.5 3.5 1.5.9-1 2.1-1.5 3.5-1.5 2.4 0 4.4 1.7 5 4.7"/></>,
  consistency:<><path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2"/><path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2"/><path d="M17.5 3.5v3.7h-3.7M6.5 20.5v-3.7h3.7"/></>,
} as const;

export type ArenaIconName=keyof typeof PATHS;

export function ArenaIcon({name,size=18,strokeWidth=1.75,...rest}:{name:ArenaIconName;size?:number;strokeWidth?:number}&Omit<SVGProps<SVGSVGElement>,'name'>){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{PATHS[name]}</svg>;
}
