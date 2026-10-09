import type {Metadata} from 'next';
import Dashboard from '../dashboard/page';

export const metadata:Metadata={
  title:'OP CLIMB — Original Arena Refinement Preview',
  description:'Preview premium polish to the existing OP CLIMB player dashboard, not a full redesign.',
  robots:{index:false,follow:false},
};

// This review-only route is NOT part of the existing production branch.
// Uses the same dashboard as a signed-in user; signed-out views display
// the pre-existing demonstration account (labeled by the stats component).
export default function OriginalArenaPreview(){
  return <Dashboard/>;
}
