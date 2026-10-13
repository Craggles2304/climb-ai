import {NextResponse} from 'next/server';

/**
 * Public, PRE-GAME static reference options. Nothing here consumes player
 * inventory, live boards, opponents, gold, stage or other gameplay telemetry.
 * The dated source pack must be reviewed after each TFT patch.
 */
export const dynamic='force-static';
export const revalidate=86400;

export const pregameTftBuilds=[
  {
    id:'riftbeast-reroll',title:'RIFTBEAST REROLL',tier:'S',tempo:'LEVEL 5 REROLL',
    primary:'Pebbles',secondary:'Cinderling',style:'AP + AD REROLL',
    traits:['Riftbeast (7)'],units:['Krug','Scuttlecrab','Sentinel','Brambleback','Gnar','Pebbles','Cinderling'],
    items:['Blue Buff','Jeweled Gauntlet',"Rabadon's Deathcap"],
    secondaryItems:['Blue Buff','Infinity Edge','Last Whisper'],
    rationale:'A reroll option built around two low-cost carries. AP items suit Pebbles; physical items offer a separate path for Cinderling.',
    source:'PivotTFT · 18.4b · Oct 7, 2026',sourceUrl:'https://www.pivottft.com/comps/riftbeast-reroll/',
  },
  {
    id:'inferno-draven',title:'INFERNO DRAVEN',tier:'S',tempo:'FAST 9 / FLEX CAP',
    primary:'Draven',secondary:'Flexible frontline',style:'LATE-GAME AD',
    traits:['Inferno','Juggernaut'],units:[],
    items:["Guinsoo's Rageblade","Kraken's Fury",'Deathblade'],secondaryItems:[],
    rationale:'High-ceiling five-cost physical carry. Requires a functioning economy and enough protection to scale into the late game.',
    source:'TFT Ninja · 18.4b · Oct 13, 2026',sourceUrl:'https://tft.ninja/units/draven',
  },
  {
    id:'rapidfire-aphelios',title:'RAPIDFIRE APHELIOS',tier:'A',tempo:'FAST 8',
    primary:'Aphelios',secondary:'Brambleback',style:'AD BACKLINE',
    traits:['Rapidfire','Riftbeast'],units:['Aphelios','Brambleback','Amumu','Sentinel','Mama Beak','Rakan','Varus','Xayah'],
    items:['Infinity Edge',"Kraken's Fury",'Deathblade'],secondaryItems:[],
    rationale:'A conventional AD four-cost route. Keep options flexible before committing to Aphelios and a supportive frontline.',
    source:'LUM.GG & TFT Ninja · 18.4b · Oct 13, 2026',sourceUrl:'https://lum.gg/tft/team/aphelios-rapidfire',
  },
] as const;

export async function GET(){
  return NextResponse.json({
    ok:true,set:18,patch:'18.4b',asOf:'2026-10-13',
    builds:pregameTftBuilds,
    disclaimer:'PRE-GAME STATIC REFERENCE · No live board or opponent information. Multiple viable routes, not an automatic best decision. Check patch freshness before relying on the rankings.',
  },{headers:{'Cache-Control':'public, max-age=300, s-maxage=3600'}});
}
