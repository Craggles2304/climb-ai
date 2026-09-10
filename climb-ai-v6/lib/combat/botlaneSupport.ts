import type {AbilitySlot} from './combos';
import type {AdvancedDuelAbilityOverlay} from './duelAdvanced';
import type {AllyUtilityOverlay} from './botlane';

export interface BotLaneUtilityProfile{
  abilityOverlays:Partial<Record<AbilitySlot,AdvancedDuelAbilityOverlay>>;
  allyUtility:Partial<Record<AbilitySlot,AllyUtilityOverlay>>;
  modelled:string[];
  partial:string[];
  notes:string[];
}

type Ranks=Partial<Record<AbilitySlot,number>>;
interface Context{level:number;abilityPower:number;maxHealth:number}

/**
 * Utility that only makes sense once an ally exists.
 *
 * Damage remains sourced from the normal spell importer. This file handles the
 * support-side decision the 1v1 engine cannot represent: shield/heal the allied
 * carry, or crowd-control the shared focus target. Ambiguous two-way spells are
 * deliberately assigned an explicit default policy and documented in `notes`.
 */
export function buildBotLaneUtilityProfile(
  championId:string,ranks:Ranks,context:Context,
):BotLaneUtilityProfile{
  const out:BotLaneUtilityProfile={abilityOverlays:{},allyUtility:{},modelled:[],partial:[],notes:[]};
  const id=normalise(championId);
  if(id==='lulu')applyLulu(out,ranks,context);
  if(id==='lux')applyLux(out,ranks,context);
  if(id==='nami')applyNami(out,ranks,context);
  if(id==='nautilus')applyNautilus(out,ranks,context);
  return out;
}

function applyLulu(out:BotLaneUtilityProfile,ranks:Ranks,context:Context){
  const w=rank(ranks.W,5);
  if(w>0){
    const duration=[1.2,1.4,1.6,1.8,2][w-1];
    out.abilityOverlays.W={targetControl:{
      label:'Whimsy polymorph',kind:'SILENCE',durationSeconds:duration,actionLockSeconds:duration,
    }};
    out.modelled.push('LULU_W_POLYMORPH');
    out.partial.push('LULU_W_ALLY_HASTE_MODE');
    out.notes.push(`Lulu W bot-duo policy: enemy cast. Polymorph action-locks the focus target for ${duration}s. Ally-cast attack/movement-speed mode is not selected automatically.`);
  }

  const e=rank(ranks.E,5);
  if(e>0){
    const shield=[70,110,150,190,230][e-1]+.50*Math.max(0,context.abilityPower);
    out.allyUtility.E={shield:{label:'Help, Pix!',amount:round(shield),durationSeconds:2.5,scope:'ALL'}};
    out.modelled.push('LULU_E_ALLY_SHIELD');
    out.partial.push('LULU_E_ENEMY_CAST_MODE','LULU_PIX_FOLLOWUP_BOLTS');
    out.notes.push(`Lulu E bot-duo policy: shield the protected ally for ${round(shield)} for 2.5s. Enemy-cast E and Pix follow-up bolts are separate states and are not guessed.`);
  }
}

function applyLux(out:BotLaneUtilityProfile,ranks:Ranks,context:Context){
  const q=rank(ranks.Q,5);
  if(q>0){
    out.abilityOverlays.Q={targetControl:{
      label:'Light Binding root',kind:'ROOT',durationSeconds:2,actionLockSeconds:0,
    }};
    out.modelled.push('LUX_Q_ROOT');
    out.notes.push('Lux Q applies a 2s root. Root does not stop attacks/casts in the stationary damage model, so its movement denial is visible but has zero action-lock until range/spacing is simulated.');
  }

  const w=rank(ranks.W,5);
  if(w>0){
    const onePass=[45,65,85,105,125][w-1]+.35*Math.max(0,context.abilityPower);
    out.allyUtility.W={shield:{label:'Prismatic Barrier · outbound',amount:round(onePass),durationSeconds:2.5,scope:'ALL'}};
    out.modelled.push('LUX_W_OUTBOUND_SHIELD');
    out.partial.push('LUX_W_RETURN_SHIELD_TRAVEL');
    out.notes.push(`Lux W: the outbound pass grants ${round(onePass)} shield for 2.5s to the protected ally. The returning second shield is not scheduled until projectile travel exists, so the result is conservative.`);
  }
}

function applyNami(out:BotLaneUtilityProfile,ranks:Ranks,context:Context){
  const q=rank(ranks.Q,5);
  if(q>0){
    out.abilityOverlays.Q={targetControl:{
      label:'Aqua Prison',kind:'KNOCKUP',durationSeconds:1.5,actionLockSeconds:1.5,
    }};
    out.modelled.push('NAMI_Q_SUSPEND');
    out.notes.push('Nami Q: a hit action-locks the focus target for 1.5s. Projectile travel/skillshot miss chance are not inferred.');
  }

  const w=rank(ranks.W,5);
  if(w>0){
    const heal=[55,80,105,130,155][w-1]+.40*Math.max(0,context.abilityPower);
    out.allyUtility.W={heal:{label:'Ebb and Flow · ally first',amount:round(heal)}};
    out.modelled.push('NAMI_W_FIRST_ALLY_HEAL');
    out.partial.push('NAMI_W_BOUNCES');
    out.notes.push(`Nami W bot-duo policy: first cast heals the protected ally for ${round(heal)}. Enemy/ally bounce order and per-bounce modifier remain partial rather than being assumed.`);
  }
}

function applyNautilus(out:BotLaneUtilityProfile,ranks:Ranks,_context:Context){
  const q=rank(ranks.Q,5);
  if(q>0){
    out.abilityOverlays.Q={targetControl:{
      label:'Dredge Line',kind:'STUN',durationSeconds:1,actionLockSeconds:1,
    }};
    out.modelled.push('NAUTILUS_Q_STUN');
    out.notes.push('Nautilus Q: a champion hit action-locks the focus target for 1s. Hook travel, pull displacement and terrain cases are not simulated yet.');
  }
  const r=rank(ranks.R,3);
  if(r>0){
    const stun=[1,1.5,2][r-1];
    out.abilityOverlays.R={targetControl:{
      label:'Depth Charge primary target',kind:'KNOCKUP',durationSeconds:stun,actionLockSeconds:stun,
    }};
    out.modelled.push('NAUTILUS_R_PRIMARY_CC');
    out.partial.push('NAUTILUS_R_PATH_KNOCKUPS');
    out.notes.push(`Nautilus R: primary target is action-locked for ${stun}s. Knock-ups on champions crossed by the missile path need positional simulation.`);
  }
  out.partial.push('NAUTILUS_PASSIVE_FIRST_AUTO_ROOT');
  out.notes.push('Staggering Blow is registered as a remaining auto-control primitive: the 6s per-target cooldown needs per-target proc state before it can be exact in 2v2.');
}

function rank(value:number|undefined,max:number){const n=Number.isFinite(value)?Math.round(value as number):0;return Math.max(0,Math.min(max,n))}
const normalise=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(n:number)=>Math.round(n*100)/100;