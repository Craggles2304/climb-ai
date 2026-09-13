import type {Metadata} from 'next';
export const metadata:Metadata={title:'Live Companion',description:'OP CLIMB Live Companion records your own game locally and turns it into post-game coaching.',robots:{index:false,follow:false}};
export default function LiveLayout({children}:{children:React.ReactNode}){return children}
