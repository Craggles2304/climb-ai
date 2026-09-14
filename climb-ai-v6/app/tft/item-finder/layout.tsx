import {TftLegacyMetaBanner} from '@/components/TftLegacyMetaBanner';

export default function Layout({children}:{children:React.ReactNode}){
  return <>
    <TftLegacyMetaBanner />
    {children}
  </>;
}
