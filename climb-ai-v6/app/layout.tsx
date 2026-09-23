import './globals.css';
import './live-review-cleanup.css';
import './op-wow.css';
import './op-live-wow.css';
import './op-visual-first.css';
import './op-data-visual.css';
import './op-analyse-visual.css';
import './op-esports.css';
import './op-tempo-visual.css';
import './public-launch.css';
import './ilp-explainability.css';
import './ux-journey.css';
import './public-personal.css';
import './broadcast-system.css';
import type {Metadata} from 'next';
import {Oswald,Barlow,JetBrains_Mono} from 'next/font/google';
import {SessionProvider} from '@/components/SessionContext';
import {AccountProvider} from '@/components/AccountContext';
import {LearningPlanProvider} from '@/components/LearningPlanContext';
import {SubscriptionProvider} from '@/components/SubscriptionContext';

const display=Oswald({subsets:['latin'],weight:['600','700'],variable:'--font-display',display:'swap'});
const body=Barlow({subsets:['latin'],weight:['400','500','600'],variable:'--font-body',display:'swap'});
const mono=JetBrains_Mono({subsets:['latin'],weight:['400','600'],variable:'--font-mono',display:'swap'});

const SITE='https://opclimb.com';
const description='OP CLIMB turns your League of Legends matches into a personal coaching plan: one repeated leak, one next-game rule, and proof across future games.';

export const metadata:Metadata={
  metadataBase:new URL(SITE),
  title:{default:'OP CLIMB — League Coaching That Learns How You Play',template:'%s | OP CLIMB'},
  description,
  applicationName:'OP CLIMB',
  keywords:['League of Legends coaching','League improvement','LoL match analysis','League of Legends tracker','OP CLIMB'],
  openGraph:{type:'website',siteName:'OP CLIMB',url:SITE,title:'OP CLIMB — League Coaching That Learns How You Play',description,images:[{url:'/opengraph-image',width:1200,height:630,alt:'OP CLIMB — personal League of Legends coaching'}]},
  twitter:{card:'summary_large_image',title:'OP CLIMB — League Coaching That Learns How You Play',description,images:['/twitter-image']},
  icons:{icon:[{url:'/favicon.ico'},{url:'/icon.svg',type:'image/svg+xml'}],apple:'/brand/overpowered-crest.png'},
  manifest:'/manifest.webmanifest',
};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={display.variable+' '+body.variable+' '+mono.variable}><SessionProvider><SubscriptionProvider><AccountProvider><LearningPlanProvider>{children}</LearningPlanProvider></AccountProvider></SubscriptionProvider></SessionProvider></body></html>}
