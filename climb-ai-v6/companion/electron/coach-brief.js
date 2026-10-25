/* OP CLIMB Companion — action-first pregame coaching.
 * Never display chopped sentences with an ellipsis. Convert the existing
 * authorised pre-game plan into one short practical cue, and keep the full
 * explanation behind an explicit disclosure. No live opponent data used.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OPCoachBrief=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const has=(value,regex)=>regex.test(clean(value));
  const basics={
    TOP:'Control your wave. Join important team fights.',
    JUNGLE:'Track your lanes and arrive early to objectives.',
    MID:'Clear your wave safely. Move with your team.',
    ADC:'Keep your range. Hit the nearest safe target.',
    SUPPORT:'Protect your carries. Save CC for enemy engages.',
  };
  function cue(kind,value,role=''){
    const s=clean(value);
    const r=String(role).toUpperCase();
    if(kind==='MOVE'){
      if(has(s,/survive.{0,35}dive|keep.{0,12}range|nearest safe target|their divers/i))
        return 'Keep your range. Hit the nearest safe target.';
      if(has(s,/before you commit|health.{0,50}escape|red.state fight/i))
        return 'Check health, levels and your escape before fighting.';
      if(has(s,/wave.{0,30}move|clear.{0,30}wave|lane priority/i))
        return 'Clear your wave safely. Move before your opponent.';
      if(has(s,/peel|protect.{0,22}carry|keep.{0,22}alive/i))
        return 'Stay with your carry. Save your CC for divers.';
      if(has(s,/objective|dragon|baron|herald/i))
        return 'Push your wave, then arrive early to objectives.';
      if(has(s,/reset|spend.{0,25}gold/i))
        return 'Reset on time. Spend gold before the next fight.';
      if(has(s,/flank|side.lane|split.push/i))
        return 'Control the side lane. Rejoin before the fight.';
      if(has(s,/engage|start.{0,12}fight/i))
        return 'Engage when your teammates are ready to follow.';
      return basics[r]||'Choose a safe fight. Stay connected to your team.';
    }
    if(kind==='WIN'){
      if(has(s,/core items|safe farm|item.{0,12}spike/i))
        return 'Farm for core items. Group before objectives.';
      if(has(s,/objective|dragon|baron|herald|tower/i))
        return 'Set up early. Take the objective after a good fight.';
      if(has(s,/pick|catch|lockdown/i))
        return 'Catch one isolated opponent. Fight together.';
      if(has(s,/scale|late game/i))
        return 'Play patiently. Fight around your item spikes.';
      if(has(s,/engage|teamfight|frontline/i))
        return 'Fight together. Follow your frontline.';
      return r==='ADC'?'Farm safely. Fight behind your frontline.':'Build an advantage. Fight with your team.';
    }
    if(kind==='AVOID'){
      if(has(s,/gets onto|reaches.{0,50}before|dive|flank|assassin/i))
        return 'Do not let enemy divers reach you alone.';
      if(has(s,/chase|overextend|no vision|face.check/i))
        return 'Do not chase or enter unwarded areas alone.';
      if(has(s,/isolat|split.{0,12}apart|disconnected/i))
        return 'Do not fight away from your team.';
      if(has(s,/reset|bad timing|late/i))
        return 'Do not arrive late to objective fights.';
      if(has(s,/crowd.control|hard cc|stun/i))
        return 'Do not commit before enemy CC is used.';
      return 'Do not force fights without an escape.';
    }
    if(kind==='MISSION'){
      if(has(s,/before you commit|health.{0,50}escape|red.state|bad fight/i))
        return 'Check health, levels and your escape before fighting.';
      if(has(s,/die|death|surviv|stay alive/i))
        return 'Choose safe fights. Avoid unnecessary deaths.';
      if(has(s,/reset|buy|spend gold/i))
        return 'Reset and buy before your next fight.';
      if(has(s,/vision|minimap|scan|threat/i))
        return 'Check the map and locate threats before moving.';
      if(has(s,/farm|cs|wave/i))
        return 'Collect safe CS without missing team setup.';
      if(has(s,/objective|dragon|baron/i))
        return 'Start setting up before the objective spawns.';
      if(has(s,/engage|trade|fight/i))
        return 'Check your advantage before committing.';
      return 'Make one deliberate decision each fight.';
    }
    if(kind==='STEP'){
      if(has(s,/core items|safe farm|first wave/i))return 'Farm safely towards your first item.';
      if(has(s,/step out|access is committed|threat shows/i))return 'Wait until enemy engage is committed.';
      if(has(s,/play behind|hit nearest safe|survive.{0,25}dive/i))
        return 'Stay behind allies. Hit the safe target.';
      if(has(s,/won fight|dragon|baron|tower|convert/i))
        return 'After a win, take an objective or reset.';
      if(has(s,/wave|farm|cs/i))return 'Collect the safe wave, then regroup.';
      if(has(s,/vision|setup/i))return 'Set up vision and arrive with your team.';
      if(has(s,/reset/i))return 'Reset before the next team fight.';
      return 'Play your role and follow the team plan.';
    }
    return basics[r]||'Choose the safer play.';
  }
  return Object.freeze({cue,basics});
});
