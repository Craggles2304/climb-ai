(()=>{
  const load=src=>{const script=document.createElement('script');script.src=src;script.async=false;document.head.appendChild(script)};
  load('review-v2-core.js');
  load('review-esports.js');
  load('remember-v3.js');
})();