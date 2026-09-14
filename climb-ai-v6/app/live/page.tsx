'use client';
import {AppShell} from '@/components/AppShell';

/**
 * The live experience is composed centrally by AppShell when the pathname is
 * /live. Keeping the route itself intentionally tiny avoids shipping the old,
 * duplicate live implementation alongside the active companion components.
 */
export default function Live(){
  return <AppShell><></></AppShell>;
}
