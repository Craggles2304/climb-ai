import type { Metadata, Viewport } from 'next';
import './globals.css';
import {PWARegister} from '@/components/PWARegister';
export const metadata: Metadata = {title:{default:'CLIMB//AI',template:'%s · CLIMB//AI'},description:'Play a game. Find the one thing holding you back. Fix it next game.',manifest:'/manifest.webmanifest'};
export const viewport: Viewport = {themeColor:'#080B12',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><PWARegister/>{children}</body></html>;}