import {DNA_DOMAINS} from './dnaDomain';
import type {DnaDomain} from './types';

export function missionDomainPath(domain:DnaDomain){
  return `/missions/${domain.toLowerCase().replaceAll('_','-')}`;
}

export function missionDomainFromSlug(slug:string):DnaDomain|undefined{
  return DNA_DOMAINS.find(domain=>missionDomainPath(domain).endsWith('/'+slug));
}
