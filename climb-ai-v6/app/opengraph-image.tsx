import {ImageResponse} from 'next/og';

export const size={width:1200,height:630};
export const contentType='image/png';

export default function Image(){
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'64px 72px',background:'linear-gradient(135deg,#050a12 0%,#0b1724 60%,#06101b 100%)',color:'white',fontFamily:'Arial, sans-serif',position:'relative'}}>
      <div style={{position:'absolute',inset:0,display:'flex',background:'linear-gradient(115deg,transparent 0 58%,rgba(57,169,255,.12) 58% 61%,transparent 61%),linear-gradient(90deg,transparent 0 78%,rgba(214,255,47,.08) 78% 79%,transparent 79%)'}}/>
      <div style={{display:'flex',alignItems:'center',gap:18,zIndex:1}}><div style={{display:'flex',border:'2px solid #39a9ff',padding:'10px 14px',fontWeight:900,letterSpacing:3}}>OP</div><div style={{display:'flex',fontSize:26,fontWeight:900,letterSpacing:4}}>OP CLIMB</div></div>
      <div style={{display:'flex',flexDirection:'column',zIndex:1}}><div style={{display:'flex',flexDirection:'column',fontSize:70,fontWeight:900,lineHeight:.92,letterSpacing:-3,maxWidth:950}}><span>STOP READING STATS.</span><span style={{color:'#d6ff2f'}}>FIX THE DECISION.</span></div><div style={{display:'flex',fontSize:26,color:'#a7b2c1',marginTop:28,maxWidth:850}}>Personal League of Legends coaching that finds the repeated habit costing you games — then checks whether you fixed it.</div></div>
      <div style={{display:'flex',gap:14,zIndex:1,fontSize:16,fontWeight:800,letterSpacing:1}}><span>POST-GAME COACHING</span><span style={{color:'#39a9ff'}}>•</span><span>FIX LADDER</span><span style={{color:'#39a9ff'}}>•</span><span>DECISION FINGERPRINT</span></div>
    </div>,size,
  );
}
