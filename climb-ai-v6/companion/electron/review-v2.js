(()=>{
  const load=src=>{const script=document.createElement('script');script.src=src;script.async=false;document.head.appendChild(script)};
  load('plan-recognition-review.cjs');
  load('review-v2-core.js');
  load('review-esports.js');
  load('review-v3-read-calibration.js');
  load('remember-v3.js');
  load('remember-v3-matchup.js');
  load('remember-v5-esports.js');
  load('remember-v6-match-os.js');
  load('remember-v7-read-checkpoints.js');
})();
