import './globals.css';
import {AccountProvider} from '@/components/AccountContext';
export const metadata={title:'CLIMB//AI',description:'One game. One leak. One cue.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AccountProvider>{children}</AccountProvider></body></html>}
