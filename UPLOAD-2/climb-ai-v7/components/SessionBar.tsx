'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useSession} from './SessionContext';

/**
 * Account state in the sidebar.
 *
 * Renders nothing when auth is unconfigured, so demo mode is not cluttered with
 * an account menu that cannot do anything.
 */
export function SessionBar(){
  const {user,loading,configured,signOut}=useSession();
  const router=useRouter();
  if(!configured||loading)return null;

  if(!user){
    return <div className="session-bar">
      <span className="session-note">Demo mode — not signed in</span>
      <Link className="btn secondary" href="/login">LOG IN</Link>
    </div>;
  }

  return <div className="session-bar">
    <span className="session-note" title={user.email}>{user.email}</span>
    <button className="btn secondary" onClick={async()=>{await signOut();router.push('/login');router.refresh();}}>
      SIGN OUT
    </button>
  </div>;
}
