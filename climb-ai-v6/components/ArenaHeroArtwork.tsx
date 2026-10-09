'use client';

import {championSplash} from '@/lib/championArt';

/** Cinematic champion artwork that layers behind existing Arena page content.
 * Uses Riot Data Dragon splash illustrations, never generated faces.
 * Decorative images are hidden from assistive technology.
 */
export function ArenaHeroArtwork({champion,tag}:{champion:string;tag?:string}){
  const selected=champion&&champion!=='Unknown'?champion:'Jinx';
  return <div className="arena-page-art" aria-hidden="true">
    <img src={championSplash(selected)} alt="" loading="eager" onError={event=>{event.currentTarget.hidden=true}}/>
    <div className="arena-page-art-shade"/>
    <div className="arena-page-art-shines"/>
    {tag&&<span className="arena-page-art-caption">{tag.toUpperCase()} <b>{selected.toUpperCase()}</b></span>}
  </div>;
}
