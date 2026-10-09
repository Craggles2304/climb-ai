import type {Metadata} from 'next';
import Dashboard from '../dashboard/page';

export const metadata:Metadata={
  title:'Arena V2.2 — Cinematic Command Centre Preview',
  description:'Visual review of the redesigned OP CLIMB premium player command centre.',
  robots:{index:false,follow:false},
};

// Review the exact component used by the redesigned dashboard.
// Signed-out viewers see explicitly labelled local demonstration data.
export default function ArenaPreview(){return <Dashboard/>;}
