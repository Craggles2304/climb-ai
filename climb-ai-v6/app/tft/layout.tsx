import type {Metadata} from 'next';

const description='OP CLIMB TFT is a tactician development system for Teamfight Tactics: plan decisions, review finished games, replay key moments and build an adaptive coaching profile without requiring a Riot API key.';

export const metadata:Metadata={
  title:'TFT CLIMB — Tactician Development & Decision Coaching',
  description,
  keywords:['Teamfight Tactics coaching','TFT coaching','TFT improvement','TFT decision review','TFT tactics','OP CLIMB'],
  openGraph:{
    type:'website',
    siteName:'OP CLIMB',
    url:'https://opclimb.com/tft',
    title:'TFT CLIMB — Tactician Development & Decision Coaching',
    description,
  },
  twitter:{
    card:'summary_large_image',
    title:'TFT CLIMB — Tactician Development & Decision Coaching',
    description,
  },
};

export default function TftLayout({children}:{children:React.ReactNode}){return children;}
