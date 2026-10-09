import type {Metadata} from 'next';
import {ArenaLanding} from '@/components/ArenaLanding';
import {TrackView} from '@/components/TrackView';

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — Your Games. Your Coach.'},
  description:'Play three tracked League of Legends games, reveal your six-strand Game DNA, then train one measurable habit at a time as every new game evolves your player profile.',
  alternates:{canonical:'/'},
};

export default function Landing(){
  return <>
    <TrackView event="landing_view"/>
    <ArenaLanding/>
  </>;
}
