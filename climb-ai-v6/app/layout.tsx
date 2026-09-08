import './globals.css';
import {AccountProvider} from '@/components/AccountContext';
import {LearningPlanProvider} from '@/components/LearningPlanContext';
export const metadata={title:'CLIMB//AI',description:'Play. Analyse. Fix one thing. Prove improvement.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AccountProvider><LearningPlanProvider>{children}</LearningPlanProvider></AccountProvider></body></html>}
