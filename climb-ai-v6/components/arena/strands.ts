import type {DnaDomain} from '@/lib/types';
import type {ArenaIconName} from './ArenaIcon';

/** Visual identity for each Game DNA strand: colour token, glyph and a short code. */
export const STRAND_META:Record<DnaDomain,{color:string;icon:ArenaIconName;code:string}>={
  LANING:{color:'var(--arena-strand-laning)',icon:'laning',code:'LANE'},
  WAVES_CS:{color:'var(--arena-strand-waves)',icon:'waves',code:'WAVE'},
  VISION_MAP:{color:'var(--arena-strand-vision)',icon:'vision',code:'MAP'},
  OBJECTIVES:{color:'var(--arena-strand-objectives)',icon:'objectives',code:'OBJ'},
  TEAMFIGHTS:{color:'var(--arena-strand-teamfights)',icon:'teamfights',code:'FIGHT'},
  CONSISTENCY:{color:'var(--arena-strand-consistency)',icon:'consistency',code:'MIND'},
};
