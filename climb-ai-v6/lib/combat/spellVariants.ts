import type {DamageComponent,DamageType} from './damage';

export interface VariantCalculationView{
  name:string;
  value:number|null;
  unmodelled:string[];
  primary:boolean;
}

export interface VariantAbilityView{
  name:string;
  damage:DamageComponent[];
  calculations:VariantCalculationView[];
  cost:number;
  cooldownSeconds:number;
}

interface VariantBase{
  /** Champion-effect id used to downgrade confidence if source proof fails. */
  effectId:string;
  label:string;
  costOverride?:number;
  cooldownOverrideSeconds?:number;
}

/**
 * Repeat the currently selected base component(s) as distinct hit events inside
 * one cast. This is for spells such as Taliyah Q where later projectiles use a
 * fixed fraction of the first hit.
 */
export interface RepeatPrimaryVariant extends VariantBase{
  kind:'REPEAT_PRIMARY';
  totalHits:number;
  firstHitMultiplier?:number;
  repeatHitMultiplier:number;
  /** Prevent accidentally repeating a total/empowered alternative. */
  forbiddenBaseLabelTokens?:string[];
}

/**
 * Replace the normal damage component with a named alternative formula already
 * published by the spell source, e.g. MaximumDamage for a fully charged spell.
 */
export interface SelectCalculationVariant extends VariantBase{
  kind:'SELECT_CALCULATION';
  calculationNameCandidates:string[];
  damageType:DamageType;
  multiplier?:number;
}

/**
 * Deterministically scale the currently selected base damage for a validated
 * conditional form. Useful when Riot defines the form as an exact multiple of
 * the normal hit and the source does not publish a standalone formula.
 */
export interface ScalePrimaryVariant extends VariantBase{
  kind:'SCALE_PRIMARY';
  multiplier:number;
  forbiddenBaseLabelTokens?:string[];
}

/** Keep only explicitly selected typed components from a mixed spell. */
export interface FilterComponentsVariant extends VariantBase{
  kind:'FILTER_COMPONENTS';
  includeTypes?:DamageType[];
  includeLabelTokens?:string[];
}

export type SpellCastVariant=
  |RepeatPrimaryVariant
  |SelectCalculationVariant
  |ScalePrimaryVariant
  |FilterComponentsVariant;

export interface SpellVariantResult{
  applied:boolean;
  effectId:string;
  damage:DamageComponent[];
  cost:number;
  cooldownSeconds:number;
  primaryCalculationNames:string[];
  note:string;
  reason?:string;
}

/**
 * Pure resolver: it never guesses a missing formula. A source mismatch returns
 * applied=false so callers can lower confidence instead of applying a plausible
 * but unverified number.
 */
export function resolveSpellCastVariant(
  ability:VariantAbilityView,
  spec:SpellCastVariant,
):SpellVariantResult{
  const base={
    effectId:spec.effectId,
    cost:finiteOverride(spec.costOverride,ability.cost),
    cooldownSeconds:finiteOverride(spec.cooldownOverrideSeconds,ability.cooldownSeconds),
  };

  if(spec.kind==='REPEAT_PRIMARY'){
    const hits=Math.max(1,Math.min(32,Math.round(spec.totalHits)));
    const first=finiteNonNegative(spec.firstHitMultiplier??1);
    const repeat=finiteNonNegative(spec.repeatHitMultiplier);
    if(hits<2)return failed(base,ability,spec,'A multi-hit variant must contain at least two hits.');
    if(!ability.damage.length)return failed(base,ability,spec,'The base spell has no resolved damage component to repeat.');
    if(ability.damage.some(c=>c.raw===null||!Number.isFinite(c.raw)))
      return failed(base,ability,spec,'The base spell still contains unresolved damage, so repeating it would multiply an unknown value.');
    const forbidden=(spec.forbiddenBaseLabelTokens??[]).map(normalise).filter(Boolean);
    const labels=ability.damage.map(c=>normalise(c.label)).join(' ');
    const bad=forbidden.find(token=>labels.includes(token));
    if(bad)
      return failed(base,ability,spec,`The selected base damage already looks like a ${bad} variant, so it will not be repeated again.`);

    const damage:DamageComponent[]=[];
    for(let hit=1;hit<=hits;hit++){
      const multiplier=hit===1?first:repeat;
      for(const component of ability.damage){
        damage.push({
          ...component,
          label:`${spec.label} · hit ${hit}/${hits} · ${component.label}`,
          raw:round((component.raw as number)*multiplier),
        });
      }
    }
    const totalMultiplier=first+repeat*(hits-1);
    return {
      applied:true,...base,damage,
      primaryCalculationNames:ability.calculations.filter(c=>c.primary).map(c=>c.name),
      note:`${spec.label}: ${hits} hits resolved separately (${round(first*100)}% first hit, ${round(repeat*100)}% each repeat; ${round(totalMultiplier*100)}% total of the base hit if all connect).`,
    };
  }

  if(spec.kind==='SELECT_CALCULATION'){
    const candidates=rankCandidates(ability.calculations,spec.calculationNameCandidates)
      .filter(x=>x.calculation.value!==null&&x.calculation.unmodelled.length===0);
    if(!candidates.length)
      return failed(base,ability,spec,`${spec.label} needs a resolved source calculation matching ${spec.calculationNameCandidates.join(' / ')}, but none was found.`);
    const bestScore=candidates[0].score;
    const best=candidates.filter(x=>x.score===bestScore);
    if(best.length!==1)
      return failed(base,ability,spec,`${spec.label} matched more than one equally strong source calculation, so the engine will not choose between them.`);

    const chosen=best[0].calculation;
    const multiplier=finiteNonNegative(spec.multiplier??1);
    return {
      applied:true,...base,
      damage:[{
        label:`${spec.label} · ${chosen.name}`,
        type:spec.damageType,
        raw:round((chosen.value as number)*multiplier),
        unmodelled:chosen.unmodelled,
      }],
      primaryCalculationNames:[chosen.name],
      note:`${spec.label}: source calculation ${chosen.name} selected explicitly${multiplier===1?'':` and scaled ×${round(multiplier)}`}.`,
    };
  }

  if(spec.kind==='SCALE_PRIMARY'){
    const multiplier=finiteNonNegative(spec.multiplier);
    if(!ability.damage.length)return failed(base,ability,spec,'The base spell has no resolved damage component to scale.');
    if(ability.damage.some(c=>c.raw===null||!Number.isFinite(c.raw)))
      return failed(base,ability,spec,'The base spell still contains unresolved damage, so the conditional form cannot be scaled safely.');
    const forbidden=(spec.forbiddenBaseLabelTokens??[]).map(normalise).filter(Boolean);
    const labels=ability.damage.map(c=>normalise(c.label)).join(' ');
    const bad=forbidden.find(token=>labels.includes(token));
    if(bad)
      return failed(base,ability,spec,`The selected base damage already looks like a ${bad} variant, so the conditional multiplier was not applied.`);
    return {
      applied:true,...base,
      damage:ability.damage.map(component=>({
        ...component,
        label:`${spec.label} · ${component.label}`,
        raw:round((component.raw as number)*multiplier),
      })),
      primaryCalculationNames:ability.calculations.filter(c=>c.primary).map(c=>c.name),
      note:`${spec.label}: validated conditional multiplier ×${round(multiplier)} applied to the resolved base component${ability.damage.length===1?'':'s'}.`,
    };
  }

  const types=new Set(spec.includeTypes??[]);
  const tokens=(spec.includeLabelTokens??[]).map(normalise).filter(Boolean);
  const damage=ability.damage.filter(component=>
    (types.size>0&&types.has(component.type))
    ||tokens.some(token=>normalise(component.label).includes(token)),
  );
  if(!damage.length)
    return failed(base,ability,spec,`${spec.label} did not match any resolved damage components, so nothing was removed or invented.`);
  return {
    applied:true,...base,damage,
    primaryCalculationNames:damage.map(d=>d.label),
    note:`${spec.label}: kept ${damage.length} explicitly selected damage component${damage.length===1?'':'s'} from the cast.`,
  };
}

function rankCandidates(
  calculations:VariantCalculationView[],
  names:string[],
):{calculation:VariantCalculationView;score:number}[]{
  const hints=names.map((name,index)=>({name:normalise(name),index})).filter(x=>x.name);
  const out:{calculation:VariantCalculationView;score:number}[]=[];
  for(const calculation of calculations){
    const key=normalise(calculation.name);
    let score=0;
    for(const hint of hints){
      if(key===hint.name)score=Math.max(score,1000-hint.index);
      else if(key.includes(hint.name))score=Math.max(score,500-hint.index);
    }
    if(score>0)out.push({calculation,score});
  }
  return out.sort((a,b)=>b.score-a.score||a.calculation.name.localeCompare(b.calculation.name));
}

function failed(
  base:{effectId:string;cost:number;cooldownSeconds:number},
  ability:VariantAbilityView,
  spec:SpellCastVariant,
  reason:string,
):SpellVariantResult{
  return {
    applied:false,...base,
    damage:ability.damage,
    primaryCalculationNames:ability.calculations.filter(c=>c.primary).map(c=>c.name),
    note:`${spec.label}: not applied. ${reason}`,
    reason,
  };
}

const finiteOverride=(value:number|undefined,fallback:number)=>
  Number.isFinite(value)?Math.max(0,value as number):fallback;
const finiteNonNegative=(value:number)=>Number.isFinite(value)?Math.max(0,value):0;
const normalise=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(n:number)=>Math.round(n*100)/100;