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
    <TrackView event="landing_view"/>
    <BroadcastLanding/>
  </>;
}
