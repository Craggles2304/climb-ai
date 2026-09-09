import './globals.css';
import {BRAND} from '@/lib/brand';
import {SessionProvider} from '@/components/SessionContext';
import {AccountProvider} from '@/components/AccountContext';
import {LearningPlanProvider} from '@/components/LearningPlanContext';
export const metadata={title:BRAND.name,description:BRAND.description};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><SessionProvider><AccountProvider><LearningPlanProvider>{children}</LearningPlanProvider></AccountProvider></SessionProvider></body></html>}
