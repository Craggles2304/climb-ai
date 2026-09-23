import type {Metadata} from 'next';
import {Oswald,Barlow,JetBrains_Mono} from 'next/font/google';
import {BroadcastLanding} from '@/components/BroadcastLanding';
import {TrackView} from '@/components/TrackView';

const display=Oswald({subsets:['latin'],weight:['600','700'],variable:'--font-display',display:'swap'});
const body=Barlow({subsets:['latin'],weight:['400','500','600'],variable:'--font-body',display:'swap'});
const mono=JetBrains_Mono({subsets:['latin'],weight:['400','600'],variable:'--font-mono',display:'swap'});

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — Your Games. Your Coach.'},
  description:'Personal League of Legends coaching built from your own ranked evidence: one repeated pattern, one next-game focus, and proof across future games.',
  alternates:{canonical:'/'},
};

export default function Landing(){
  return <div className={display.variable+' '+body.variable+' '+mono.variable}>
    <TrackView event="landing_view"/>
    <BroadcastLanding/>
  </div>;
}
