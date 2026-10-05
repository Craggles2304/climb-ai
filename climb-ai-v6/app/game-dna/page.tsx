import {redirect} from 'next/navigation';

export default async function GameDnaRedirect({
  searchParams,
}:{searchParams:Promise<{role?:string}>}){
  const params=await searchParams;
  const role=typeof params.role==='string'&&params.role.trim()?params.role.trim():'';
  redirect(role?'/ilp?role='+encodeURIComponent(role):'/ilp');
}
