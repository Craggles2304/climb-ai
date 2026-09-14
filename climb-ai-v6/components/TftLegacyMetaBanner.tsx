import Link from 'next/link';

export function TftLegacyMetaBanner(){
  return <div style={{position:'sticky',top:0,zIndex:1200,padding:'10px 16px',background:'rgba(255,166,0,.16)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(255,200,90,.35)',display:'flex',justifyContent:'center',gap:10,alignItems:'center',flexWrap:'wrap'}}>
    <strong style={{fontSize:12,letterSpacing:'.08em'}}>LEGACY SET 17 META SNAPSHOT</strong>
    <span style={{fontSize:11,opacity:.82}}>Performance and seeded item recommendations on this page are not current Set 18 meta. Current Riot static unit data may differ.</span>
    <Link href="/tft/roll-lab" className="text-link" style={{fontSize:11}}>USE CURRENT SET 18 ROLL LAB →</Link>
  </div>;
}
