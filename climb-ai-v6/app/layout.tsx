import './globals.css';
import './live-review-cleanup.css';
import './op-wow.css';
import './op-live-wow.css';
import {BRAND} from '@/lib/brand';
import {SessionProvider} from '@/components/SessionContext';
import {AccountProvider} from '@/components/AccountContext';
import {LearningPlanProvider} from '@/components/LearningPlanContext';
import {SubscriptionProvider} from '@/components/SubscriptionContext';
export const metadata={title:BRAND.name,description:BRAND.description};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><SessionProvider><SubscriptionProvider><AccountProvider><LearningPlanProvider>{children}</LearningPlanProvider></AccountProvider></SubscriptionProvider></SessionProvider></body></html>}
