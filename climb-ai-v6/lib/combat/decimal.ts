export function roundCombat(value:number,places=2):number{
  if(!Number.isFinite(value))return 0;
  const digits=Math.max(0,Math.min(8,Math.trunc(places)));
  const factor=10**digits;
  // Combat timestamps routinely land on decimal half-boundaries (for example
  // Galio's 20.625% windup with +0.25 attacks/s = 0.165s). Binary floating
  // point can represent that as 0.164999..., making Math.round choose the
  // wrong hundredth. Scale-aware epsilon restores conventional half-up
  // rounding without changing values that are materially below a boundary.
  const scaled=value*factor;
  const epsilon=Number.EPSILON*Math.max(1,Math.abs(scaled))*4;
  return Math.round(scaled+Math.sign(scaled||1)*epsilon)/factor;
}
