import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {ArenaDesignLab} from './ArenaDesignLab';

export const metadata:Metadata={title:'Arena V2.1 design lab',robots:{index:false,follow:false}};
// Decided per request so a production deployment answers with a real 404 status.
export const dynamic='force-dynamic';

/**
 * Living gallery of the Arena V2.1 design system, rendered with clearly labelled
 * sample data. Available in development; production builds return 404 unless
 * ARENA_DESIGN_LAB=1 was set for that build.
 */
export default function ArenaDesignLabPage(){
  if(process.env.NODE_ENV==='production'&&process.env.ARENA_DESIGN_LAB!=='1')notFound();
  return <ArenaDesignLab/>;
}
