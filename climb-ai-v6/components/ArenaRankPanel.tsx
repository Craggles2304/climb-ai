import {ArenaIcon} from '@/components/ArenaIcon';

const rankPalette:Record<string,[string,string]>={
 IRON:['#9eaaa9','#47505d'],
 BRONZE:['#e2ad86','#8b5335'],
 SILVER:['#cddde9','#6b9eb4'],
 GOLD:['#f2db87','#b27a2b'],
 PLATINUM:['#8ee8dc','#2f8d96'],
 EMERALD:['#8df7a1','#257d68'],
 DIAMOND:['#a7d4ff','#6579e8'],
 MASTER:['#cb9bff','#7d4ece'],
 GRANDMASTER:['#ffa9a7','#a42a50'],
 CHALLENGER:['#f9e3ae','#b8a35e'],
};
const rankColour=(rank:string)=>{
 const key=Object.keys(rankPalette).find(item=>rank.toUpperCase().startsWith(item));
 return key?rankPalette[key]:['#b2c2c9','#52606f'] as [string,string];
};

/** Decorative first-party ranked identity mark. Not an official Riot rank emblem. */
export function ArenaRankPanel({rank,role,champion,region}:{rank:string;role:string;champion:string;region:string}){
 const [main,shade]=rankColour(rank);
 return <div className="arena-pro-rank-panel" style={{'--rank-hue':main,'--rank-shade':shade} as React.CSSProperties}>
   <div className="arena-pro-rank-top"><span>RANKED IDENTITY</span><span className="arena-pro-rank-league">LEAGUE</span></div>
   <div className="arena-pro-rank-main">
     <svg viewBox="0 0 120 132" width="96" height="108" aria-hidden="true" focusable="false" fill="none">
       <defs><linearGradient id="arena-rank-plate" x1="0" y1="0" x2="1" y2="1"><stop stopColor={main}/><stop offset="1" stopColor={shade}/></linearGradient></defs>
       <path d="M60 7 105 27 105 82 60 124 15 82 15 27Z" fill="#08121f" stroke={main} strokeWidth="2.5"/>
       <path d="M60 20 91 36 91 78 60 108 29 78 29 36Z" fill="url(#arena-rank-plate)" opacity=".26"/>
       <path d="M60 20 87 38 85 79 60 104 35 79 33 38Z" stroke={main} opacity=".75" strokeWidth="1.5"/>
       <path d="M60 26 77 55 60 91 43 55Z" fill="url(#arena-rank-plate)" stroke="#e7fbfa" strokeWidth="2.2"/>
       <path d="M60 26v65L77 55Z" fill={shade} opacity=".83"/>
       <path d="M44 57h32" stroke="#e6fbf7" strokeWidth="1.5"/>
       <path d="M9 48 20 56 20 81 8 70M111 48 100 56 100 81 112 70" stroke={main} strokeWidth="2"/>
       <path d="M32 9 60 1 88 9M32 119l28 12 28-12" stroke={main} strokeWidth="2"/>
     </svg>
     <div><span>YOUR CURRENT RANK</span><strong>{rank||'Unranked'}</strong><small>{region.toUpperCase()} · {role}</small></div>
   </div>
   <div className="arena-pro-rank-bottom"><span><ArenaIcon name="sword" size={13}/> {champion.toUpperCase()}</span><span>PLAYER PROFILE <b>◆</b></span></div>
 </div>;
}
