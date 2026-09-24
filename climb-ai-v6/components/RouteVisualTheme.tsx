'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

function areaFor(pathname:string){
  if(pathname==='/')return'home';
  if(pathname.startsWith('/dashboard'))return'hq';
  if(pathname.startsWith('/live')||pathname.startsWith('/session'))return'match';
  if(pathname.startsWith('/analyse')||pathname.startsWith('/advanced-statistics'))return'review';
  if(pathname.startsWith('/progress')||pathname.startsWith('/ilp')||pathname.startsWith('/missions'))return'climb';
  if(pathname.startsWith('/coach'))return'coach';
  if(pathname.startsWith('/champions')||pathname.startsWith('/matchups')||pathname.startsWith('/matchup-lab'))return'lab';
  if(pathname.startsWith('/pricing')||pathname.startsWith('/billing'))return'plans';
  if(pathname.startsWith('/tft'))return'tft';
  if(pathname.startsWith('/admin'))return'admin';
  if(pathname.startsWith('/login')||pathname.startsWith('/signup')||pathname.startsWith('/forgot-password')||pathname.startsWith('/reset-password')||pathname.startsWith('/beta/join'))return'auth';
  if(pathname.startsWith('/account')||pathname.startsWith('/settings')||pathname.startsWith('/onboarding')||pathname.startsWith('/activate')||pathname.startsWith('/uploads'))return'system';
  if(pathname.startsWith('/privacy')||pathname.startsWith('/terms')||pathname.startsWith('/support')||pathname.startsWith('/demo'))return'public';
  return'league';
}

export function RouteVisualTheme(){
  const pathname=usePathname();
  useEffect(()=>{
    const body=document.body;
    body.dataset.opArea=areaFor(pathname);
    body.dataset.opPath=pathname;
    return()=>{delete body.dataset.opArea;delete body.dataset.opPath};
  },[pathname]);
  return null;
}
