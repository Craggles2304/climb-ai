import type {Metadata} from 'next';
import {BroadcastLanding} from '@/components/BroadcastLanding';
import {TrackView} from '@/components/TrackView';

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — Your Games. Your Coach.'},
  description:'Personal League of Legends coaching built from your own ranked evidence: one repeated pattern, one next-game focus, and proof across future games.',
  alternates:{canonical:'/'},
};

export default function Landing(){
  return <>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"/>
    <TrackView event="landing_view"/>
    <BroadcastLanding/>
  </>;
}
