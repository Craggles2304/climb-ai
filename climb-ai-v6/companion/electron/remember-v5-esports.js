(()=>{
  const $=id=>document.getElementById(id);
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const VALID_ROLES=['TOP','JUNGLE','MID','ADC','SUPPORT'];
  const normRole=value=>{const raw=upper(value);if(!raw||['NONE','UNKNOWN','UNSELECTED','INVALID'].includes(raw))return'';const role=raw==='BOTTOM'?'ADC':raw==='UTILITY'?'SUPPORT':raw==='MIDDLE'?'MID':raw;return VALID_ROLES.includes(role)?role:''};
  const ROLE_ORDER={TOP:0,JUNGLE:1,MID:2,ADC:3,SUPPORT:4};
  const DEEP_PLAN_STORAGE_KEY='opclimb.deep-locked-plan.v1';
  const STRONG_ADC_PRIOR=new Set(['Aphelios','Caitlyn','Draven','Ezreal','Jhin','Jinx',"Kai\'Sa",'Kalista',"Kog\'Maw",'Nilah','Samira','Sivir','Smolder','Tristana','Twitch','Vayne','Xayah','Zeri','Yunara']);
  const ASSET_IDS={
    Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
  };
  const HYPER_CARRY=new Set(['Aphelios','Aurelion Sol','Azir','Cassiopeia','Jinx',"Kog\'Maw",'Smolder','Twitch','Vayne','Viktor','Vladimir','Zeri']);
  const SIDE_CARRY=new Set(['Camille','Fiora','Gangplank','Gwen','Irelia','Jax','Kayle','Nasus','Tryndamere','Vayne','Yorick']);
  const CARRY_JUNGLE=new Set(["Bel'Veth",'Graves','Karthus','Kindred','Lillia','Master Yi','Nidalee','Nocturne','Shyvana','Viego']);
  const FRONTLINE=new Set(['Alistar','Amumu','Braum',"Cho'Gath",'Dr. Mundo','Galio','Gragas',"K'Sante",'Leona','Maokai','Malphite','Nautilus','Ornn','Poppy','Rakan','Rell','Sejuani','Sett','Shen','Sion','Skarner','Tahm Kench','Taric','Volibear','Zac']);
  const SCALERS=new Set(['Aphelios','Aurelion Sol','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred',"Kog'Maw",'Master Yi','Nasus','Senna','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir']);
  const EARLY=new Set(['Darius','Draven','Elise','Jarvan IV','Jayce','Kalista','Kled','Lee Sin','LeBlanc','Lucian','Nidalee','Olaf','Pantheon','Pyke',"Rek'Sai",'Renekton','Rumble','Talon','Xin Zhao','Zed']);
  const ASSASSINS=new Set(['Akali','Diana','Ekko','Evelynn','Fizz','Katarina',"Kha'Zix",'Kayn','Naafiri','Nocturne','Qiyana','Rengar','Shaco','Talon','Zed']);
  const HARD_ENGAGE=new Set(['Alistar','Amumu','Blitzcrank','Galio','Hecarim','Jarvan IV','Leona','Malphite','Maokai','Nautilus','Nocturne','Ornn','Rakan','Rell','Sejuani','Skarner','Vi','Wukong','Zac']);
  const DIVERS=new Set(['Camille','Diana','Hecarim','Irelia','Jax','Jarvan IV','Kled','Nocturne','Olaf','Pantheon','Renekton','Vi','Volibear','Wukong','Xin Zhao','Yone']);
  const ZONE_CONTROL=new Set(['Anivia','Azir','Brand','Fiddlesticks','Gangplank','Heimerdinger','Hwei','Kennen','Orianna','Rumble','Taliyah','Veigar','Viktor','Ziggs','Zyra']);
  const AOE_CARRY=new Set(['Brand','Fiddlesticks','Karthus','Katarina','Kennen','Miss Fortune','Orianna','Rumble','Samira','Swain','Viktor']);
  const PICK=new Set(['Ahri','Ashe','Blitzcrank','Elise','Jhin','Leona','Lux','Morgana','Nautilus','Neeko','Pyke','Rakan','Thresh','Twisted Fate','Vi']);
  const PEEL=new Set(['Alistar','Annie','Braum','Janna','Karma','Lulu','Maokai','Milio','Nami','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Thresh','Zilean']);
  let lastState=null;
  let lastRoster=null;
  let lastRosterSignature='';
  let lastCoachSignature='';
  let lastCoach=null;
  let lastCoachAttemptSignature='';
  let lastCoachAttemptAt=0;
  let coachInFlight=false;
  let lastPlaybook=null;
  let selectedBranch='EVEN';
  let selectedContingency='PLAN_A';
  let lastCoachMeta={source:'local',quality:null,failure:null};
  let skippedIntentProbeId='';
  let lastRosterSeenAt=0;

  const assetId=name=>ASSET_IDS[clean(name)]||clean(name).replace(/[^A-Za-z0-9]/g,'');
  const splash=name=>`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${assetId(name)}_0.jpg`;
  const tile=name=>`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${assetId(name)}_0.jpg`;
  const set=(id,value)=>{const node=$(id);if(node&&clean(value))node.textContent=upper(value)};
  function emitMatchContract(coach){
    try{
      window.dispatchEvent(new CustomEvent('op-climb-match-os',{detail:{
        contract:coach?._matchContract||null,
        intentProbe:coach?._intentProbe||null,
        intentSkipped:Boolean(coach?._intentProbe?.id&&skippedIntentProbeId===coach._intentProbe.id),
        gameTime:Number(lastRoster?.gameTime)||0,
        phase:clean(lastState?.phase),
        selectedBranch,
        selectedContingency,
      }}));
    }catch{}
  }

  function installVisualLayer(){
    if($('op-v5-esports-style'))return;
    const style=document.createElement('style');
    style.id='op-v5-esports-style';
    style.textContent=`
body.op-remember-live{min-height:100vh!important;background:#04070a!important;overflow:auto!important}
body.op-remember-live:before{content:'';position:fixed;inset:0;z-index:-3;background-image:linear-gradient(90deg,rgba(3,6,9,.98) 0%,rgba(3,6,9,.92) 35%,rgba(3,6,9,.72) 69%,rgba(3,6,9,.96) 100%),var(--op-live-splash,none);background-size:cover;background-position:center 18%;filter:saturate(.82) contrast(1.08)}
body.op-remember-live:after{content:'';position:fixed;inset:0;z-index:-2;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0,rgba(255,255,255,.012) 1px,transparent 1px,transparent 4px),radial-gradient(circle at 76% 10%,rgba(214,255,47,.09),transparent 31%)}
body.op-remember-live .shell{width:100%!important;max-width:none!important;min-height:100vh!important;margin:0!important;padding:0 20px 18px!important;display:flex!important;flex-direction:column!important}
body.op-remember-live .brand{min-height:70px!important;margin:0 -20px!important;padding:12px 20px!important;background:rgba(3,6,9,.88)!important;backdrop-filter:blur(18px);border-bottom:1px solid rgba(214,255,47,.17)!important}
body.op-remember-live footer{display:none!important}
body.op-remember-live #opRememberHud{flex:1!important;min-height:calc(100vh - 94px)!important;margin:14px 0 0!important;border:1px solid rgba(214,255,47,.20)!important;border-radius:0!important;box-shadow:0 30px 90px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.035)!important;background:linear-gradient(120deg,rgba(5,10,14,.94),rgba(4,8,11,.83))!important}
body.op-remember-live #opRememberHud:before{width:5px!important;box-shadow:0 0 28px rgba(214,255,47,.55)}
body.op-remember-live .rem4-top{min-height:88px!important;padding:20px 27px 17px!important;background:linear-gradient(90deg,rgba(214,255,47,.045),transparent 48%);border-bottom-color:rgba(255,255,255,.10)!important}
body.op-remember-live .rem4-kicker{font-size:8px!important;color:#d6ff2f!important}
body.op-remember-live .rem4-title{font-size:clamp(30px,3vw,48px)!important;letter-spacing:-.05em!important;text-shadow:0 8px 32px rgba(0,0,0,.55)}
body.op-remember-live .rem4-live{font-size:8px!important;padding:9px 13px!important;background:rgba(214,255,47,.035)!important}
body.op-remember-live .rem4-body{flex:1!important;min-height:0!important;padding:18px 25px 24px!important;display:flex!important;flex-direction:column!important;gap:13px!important}
body.op-remember-live .rem4-body>section,body.op-remember-live .rem4-body>details{margin-top:0!important}
body.op-remember-live .rem4-draft{align-self:stretch!important;gap:14px!important}
body.op-remember-live .rem4-side{display:flex;flex-direction:column;min-width:0}
body.op-remember-live .rem4-side-label{font-size:8px!important;margin-bottom:8px!important;color:#9aa7af!important}
body.op-remember-live .rem4-side.enemy .rem4-side-label{color:#ff7d7d!important}
body.op-remember-live .rem4-team{flex:1!important;gap:8px!important}
body.op-remember-live .rem4-pick{height:auto!important;min-height:82px!important;border-color:rgba(255,255,255,.13)!important;background:#071018!important;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)!important;transition:transform .2s ease,border-color .2s ease}
body.op-remember-live .rem4-pick:hover{transform:translateY(-2px)}
body.op-remember-live .rem4-pick img{opacity:.82!important;filter:saturate(1.05) contrast(1.08)!important;object-position:center 22%!important}
body.op-remember-live .rem4-pick:after{background:linear-gradient(180deg,rgba(4,7,10,.02) 0%,rgba(4,7,10,.06) 33%,rgba(4,7,10,.96) 100%)!important}
body.op-remember-live .rem4-pick-copy{left:9px!important;right:7px!important;bottom:7px!important}
body.op-remember-live .rem4-pick-role{font-size:7px!important}body.op-remember-live .rem4-pick-name{font-size:11px!important}
body.op-remember-live .rem4-pick.threat{border-color:rgba(255,79,79,.75)!important;box-shadow:0 0 0 1px rgba(255,70,70,.15),inset 0 -30px 55px rgba(255,38,38,.18)!important}
body.op-remember-live .rem4-vs{font-size:11px!important;color:#d6ff2f!important;padding-bottom:34px!important}
body.op-remember-live .rem4-call-row{gap:13px!important}
body.op-remember-live .rem4-carry-strip{display:grid!important;grid-template-columns:1fr .9fr 1.35fr!important;gap:10px!important}
body.op-remember-live .rem4-carry-cell{padding:12px 14px!important;border-color:rgba(255,255,255,.11)!important;background:linear-gradient(135deg,rgba(12,20,26,.82),rgba(5,9,13,.82))!important}
body.op-remember-live .rem4-carry-cell.primary{border-color:rgba(214,255,47,.32)!important;background:linear-gradient(135deg,rgba(214,255,47,.08),rgba(5,9,13,.84))!important}
body.op-remember-live .rem4-carry-cell span{font-size:7px!important}body.op-remember-live .rem4-carry-cell strong{font-size:12px!important;margin-top:6px!important}
body.op-remember-live .rem4-call,body.op-remember-live .rem4-threat{position:relative;overflow:hidden;padding:24px 25px!important;display:flex;flex-direction:column;justify-content:center;box-shadow:inset 0 1px rgba(255,255,255,.035)}
body.op-remember-live .rem4-call{border-color:rgba(214,255,47,.48)!important;background:linear-gradient(102deg,rgba(214,255,47,.15),rgba(12,21,18,.38) 58%,rgba(4,8,11,.72))!important}
body.op-remember-live .rem4-call:after{content:'ONE JOB';position:absolute;right:20px;top:16px;font-size:7px;letter-spacing:.28em;color:rgba(214,255,47,.30);font-weight:950}
body.op-remember-live .rem4-call strong{font-size:clamp(38px,4.4vw,70px)!important;line-height:.94!important;max-width:90%;text-shadow:0 12px 40px rgba(0,0,0,.54)}
body.op-remember-live .rem4-call small{font-size:11px!important;letter-spacing:.04em!important;color:#d3dbdf!important;margin-top:12px!important}
body.op-remember-live .rem4-threat{border-color:rgba(255,75,75,.42)!important;background:linear-gradient(118deg,rgba(115,23,31,.34),rgba(9,9,13,.78))!important}
body.op-remember-live .rem4-threat:after{content:'';position:absolute;inset:0 0 0 45%;background:var(--op-threat-art,none) center 22%/cover no-repeat;opacity:.20;mask-image:linear-gradient(90deg,transparent,#000 45%);pointer-events:none}
body.op-remember-live .rem4-threat>*{position:relative;z-index:1}
body.op-remember-live .rem4-threat strong{font-size:clamp(25px,2.4vw,40px)!important;max-width:74%!important}body.op-remember-live .rem4-threat small{font-size:10px!important;max-width:72%!important}
body.op-remember-live .rem4-path-wrap{padding:17px 18px!important;border-color:rgba(214,255,47,.17)!important;background:linear-gradient(180deg,rgba(8,14,18,.86),rgba(5,9,13,.72))!important}
body.op-remember-live .rem4-path-head b{font-size:9px!important}body.op-remember-live .rem4-path-head span{font-size:7px!important}
body.op-remember-live .rem4-path{height:calc(100% - 27px)!important;gap:22px!important;align-items:stretch!important;margin-top:11px!important}
body.op-remember-live .rem4-step{display:flex!important;flex-direction:column;justify-content:center;padding:14px 13px!important;border-color:rgba(255,255,255,.12)!important;background:linear-gradient(135deg,rgba(15,24,31,.93),rgba(7,12,17,.96))!important;clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}
body.op-remember-live .rem4-step:first-child{border-color:rgba(214,255,47,.38)!important;background:linear-gradient(135deg,rgba(214,255,47,.10),rgba(7,12,17,.96))!important}
body.op-remember-live .rem4-step i{font-size:7px!important;color:#7d8b94!important}body.op-remember-live .rem4-step strong{font-size:clamp(12px,1.05vw,16px)!important;margin-top:8px!important}
body.op-remember-live .rem4-step:not(:last-child):after{font-size:30px!important;right:-18px!important;text-shadow:0 0 18px rgba(214,255,47,.42)}
body.op-remember-live .rem4-lane{height:100%!important;gap:10px!important;grid-template-columns:.72fr 1fr 1fr 1fr!important}
body.op-remember-live .rem4-lane-title,body.op-remember-live .rem4-lane-card{padding:16px!important;display:flex;flex-direction:column;justify-content:center;border-color:rgba(73,137,255,.25)!important;background:linear-gradient(135deg,rgba(35,78,151,.14),rgba(5,10,15,.73))!important}
body.op-remember-live .rem4-lane-title{border-color:rgba(77,147,255,.48)!important}body.op-remember-live .rem4-lane-title strong{font-size:17px!important}body.op-remember-live .rem4-lane-card strong{font-size:12px!important;line-height:1.35!important}body.op-remember-live .rem4-lane-card span{font-size:7px!important}
body.op-remember-live .rem4-lane-card.danger{border-color:rgba(255,75,75,.33)!important;background:linear-gradient(135deg,rgba(116,28,35,.16),rgba(5,10,15,.75))!important}
body.op-remember-live .rem4-footer{gap:10px!important}body.op-remember-live .rem4-footer article{padding:13px 15px!important;background:rgba(6,10,14,.70)!important}body.op-remember-live .rem4-footer strong{font-size:10px!important}
body.op-remember-live .rem4-check{align-self:end!important}body.op-remember-live .rem4-note{align-self:end!important}
body.op-remember-live .rem5-playbook{border:1px solid rgba(214,255,47,.18);background:linear-gradient(135deg,rgba(214,255,47,.045),rgba(5,10,14,.78));padding:13px 14px;display:grid;gap:10px}
body.op-remember-live .rem5-playbook-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
body.op-remember-live .rem5-playbook-title{font-size:8px;letter-spacing:.18em;color:#d6ff2f;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem5-coach-status{font-size:7px;letter-spacing:.12em;padding:6px 8px;border:1px solid rgba(255,255,255,.12);color:#a9b5bd;text-transform:uppercase}
body.op-remember-live .rem5-coach-status.verified{border-color:rgba(214,255,47,.35);color:#d6ff2f;background:rgba(214,255,47,.05)}
body.op-remember-live .rem5-trap{display:grid;grid-template-columns:minmax(150px,.7fr) 1.4fr;gap:10px;border:1px solid rgba(255,103,103,.2);background:linear-gradient(135deg,rgba(126,27,36,.12),rgba(5,10,14,.72));padding:11px 12px}
body.op-remember-live .rem5-trap.building{border-color:rgba(255,255,255,.08);background:rgba(4,8,12,.48)}
body.op-remember-live .rem5-trap.mastered{border-color:rgba(214,255,47,.30);background:linear-gradient(135deg,rgba(214,255,47,.08),rgba(5,10,14,.72))}
body.op-remember-live .rem5-trap-kicker{font-size:6px;letter-spacing:.16em;color:#ff8c7f;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem5-trap.building .rem5-trap-kicker{color:#7b8992}
body.op-remember-live .rem5-trap.mastered .rem5-trap-kicker{color:#d6ff2f}
body.op-remember-live .rem5-trap-title{display:block;margin-top:5px;color:#fff;font-size:11px;line-height:1.2;text-transform:uppercase}
body.op-remember-live .rem5-trap-proof{display:block;margin-top:5px;color:#6f7d86;font-size:6px;letter-spacing:.08em;text-transform:uppercase}
body.op-remember-live .rem5-trap-copy span{display:block;color:#6f7d86;font-size:6px;letter-spacing:.13em;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem5-trap-copy strong{display:block;margin-top:5px;color:#ffd9d4;font-size:9px;line-height:1.4;text-transform:uppercase}
body.op-remember-live .rem5-trap.building .rem5-trap-copy strong{color:#8f9ba3}
body.op-remember-live .rem5-trap.mastered .rem5-trap-copy strong{color:#eaff89}
body.op-remember-live .rem10-strategy{display:grid;grid-template-columns:minmax(150px,.55fr) 1.45fr;gap:10px;border:1px solid rgba(92,164,255,.22);background:linear-gradient(135deg,rgba(40,92,170,.08),rgba(5,10,14,.72));padding:11px 12px}
body.op-remember-live .rem10-strategy.fade{border-color:rgba(214,255,47,.28);background:linear-gradient(135deg,rgba(214,255,47,.06),rgba(5,10,14,.72))}
body.op-remember-live .rem10-strategy.diagnose{border-color:rgba(255,184,76,.30);background:linear-gradient(135deg,rgba(255,184,76,.055),rgba(5,10,14,.72))}
body.op-remember-live .rem10-strategy span{display:block;color:#78b7ff;font-size:6px;letter-spacing:.15em;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem10-strategy.fade span{color:#d6ff2f}body.op-remember-live .rem10-strategy.diagnose span{color:#ffbb57}
body.op-remember-live .rem10-strategy strong{display:block;margin-top:5px;color:#f3f7f8;font-size:11px;line-height:1.25;text-transform:uppercase}
body.op-remember-live .rem10-strategy p{margin:0;color:#9aa6ad;font-size:8px;line-height:1.42;text-transform:uppercase}
body.op-remember-live .rem11-intent{border:1px solid rgba(178,122,255,.28);background:linear-gradient(135deg,rgba(105,56,174,.10),rgba(5,10,14,.74));padding:11px 12px;display:grid;gap:9px}
body.op-remember-live .rem11-intent.answered{border-color:rgba(214,255,47,.24);background:linear-gradient(135deg,rgba(214,255,47,.045),rgba(5,10,14,.72))}
body.op-remember-live .rem11-intent-head span{display:block;color:#ba8aff;font-size:6px;letter-spacing:.17em;font-weight:950;text-transform:uppercase}.rem11-intent-head strong{display:block;margin-top:5px;color:#f4f7f9;font-size:10px;line-height:1.35;text-transform:uppercase}.rem11-intent-head small{display:block;margin-top:5px;color:#78858e;font-size:6px;letter-spacing:.10em;text-transform:uppercase}
body.op-remember-live .rem11-intent-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.rem11-intent-btn{appearance:none;text-align:left;border:1px solid rgba(255,255,255,.11);background:#071019;color:#dbe2e6;padding:10px 11px;font:850 8px/1.35 system-ui;text-transform:uppercase;cursor:pointer}.rem11-intent-btn:hover{border-color:rgba(186,138,255,.55)}.rem11-intent-btn:disabled{cursor:default;opacity:.55}.rem11-intent-btn.selected{border-color:rgba(214,255,47,.48);color:#eaff89;background:rgba(214,255,47,.06)}
body.op-remember-live .rem11-intent.answered .rem11-intent-head span{color:#d6ff2f}@media(max-width:980px){body.op-remember-live .rem11-intent-options{grid-template-columns:1fr}}
body.op-remember-live .rem5-premortem{border:1px solid rgba(255,184,76,.22);background:linear-gradient(135deg,rgba(255,184,76,.055),rgba(4,8,12,.72));padding:10px 11px;display:grid;gap:8px}
body.op-remember-live .rem5-premortem.building{border-color:rgba(255,255,255,.08);background:rgba(4,8,12,.46)}
body.op-remember-live .rem5-premortem-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
body.op-remember-live .rem5-premortem-head span{font-size:6px;letter-spacing:.17em;color:#ffbb57;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem5-premortem-head strong{font-size:9px;letter-spacing:.06em;color:#f2f5f7;text-transform:uppercase}
body.op-remember-live .rem5-premortem-head small{font-size:6px;letter-spacing:.09em;color:#66747e;text-transform:uppercase}
body.op-remember-live .rem5-premortem-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
body.op-remember-live .rem5-risk{border:1px solid rgba(255,255,255,.08);background:rgba(3,7,10,.58);padding:9px 10px;min-width:0}
body.op-remember-live .rem5-risk:first-child{border-color:rgba(255,184,76,.30)}
body.op-remember-live .rem5-risk>span{display:block;color:#ffbb57;font-size:6px;letter-spacing:.13em;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem5-risk b{display:block;margin-top:5px;color:#f0f4f6;font-size:9px;line-height:1.25;text-transform:uppercase}
body.op-remember-live .rem5-risk p{margin:5px 0 0;color:#89969f;font-size:7px;line-height:1.35}
body.op-remember-live .rem5-risk em{display:block;margin-top:5px;color:#e7d2aa;font:800 7px/1.35 system-ui;text-transform:uppercase}
body.op-remember-live .rem6-simulation{border:1px solid rgba(83,161,255,.25);background:linear-gradient(135deg,rgba(38,92,170,.10),rgba(4,8,12,.72));padding:10px 11px;display:grid;gap:8px}
body.op-remember-live .rem6-simulation-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
body.op-remember-live .rem6-simulation-head span{font-size:6px;letter-spacing:.17em;color:#74b5ff;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem6-simulation-head strong{font-size:9px;letter-spacing:.06em;color:#f2f5f7;text-transform:uppercase}
body.op-remember-live .rem6-simulation-head small{font-size:6px;letter-spacing:.09em;color:#66747e;text-transform:uppercase}
body.op-remember-live .rem6-simulation-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
body.op-remember-live .rem6-sim-card{border:1px solid rgba(255,255,255,.08);background:rgba(3,7,10,.58);padding:9px 10px;min-width:0}
body.op-remember-live .rem6-sim-card.personal{border-color:rgba(255,184,76,.28)}
body.op-remember-live .rem6-sim-card>span{display:block;color:#74b5ff;font-size:6px;letter-spacing:.13em;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem6-sim-card.personal>span{color:#ffbb57}
body.op-remember-live .rem6-sim-card b{display:block;margin-top:5px;color:#f0f4f6;font-size:9px;line-height:1.25;text-transform:uppercase}
body.op-remember-live .rem6-sim-card p{margin:5px 0 0;color:#8fa0aa;font-size:7px;line-height:1.35}
body.op-remember-live .rem6-sim-card em{display:block;margin-top:5px;color:#cfe4ff;font:800 7px/1.35 system-ui;text-transform:uppercase}
body.op-remember-live .rem6-sim-card.personal em{color:#ffe1af}
body.op-remember-live .rem7-memory{border:1px solid rgba(214,255,47,.28);background:linear-gradient(105deg,rgba(214,255,47,.08),rgba(4,8,12,.76));padding:11px 12px;display:grid;grid-template-columns:minmax(150px,.7fr) 1.45fr .9fr;gap:10px;align-items:stretch}
body.op-remember-live .rem7-memory>div{min-width:0}.rem7-memory-kicker{display:block;color:#d6ff2f;font-size:6px;letter-spacing:.16em;font-weight:950;text-transform:uppercase}.rem7-memory-title{display:block;margin-top:5px;color:#f5f8f9;font-size:11px;line-height:1.25;text-transform:uppercase}.rem7-memory-meta{display:block;margin-top:5px;color:#6e7b84;font-size:6px;letter-spacing:.09em;text-transform:uppercase}.rem7-memory-copy span,.rem7-memory-proof span{display:block;color:#6e7b84;font-size:6px;letter-spacing:.13em;font-weight:950;text-transform:uppercase}.rem7-memory-copy strong{display:block;margin-top:5px;color:#eaff89;font-size:9px;line-height:1.4;text-transform:uppercase}.rem7-memory-proof strong{display:block;margin-top:5px;color:#d6dee3;font-size:8px;line-height:1.4;text-transform:uppercase}
body.op-remember-live .rem5-branch-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
body.op-remember-live .rem5-branch-btn{appearance:none;border:1px solid rgba(255,255,255,.11);background:#081017;color:#8898a3;padding:9px 10px;font:950 8px/1 system-ui;letter-spacing:.14em;cursor:pointer;text-transform:uppercase}
body.op-remember-live .rem5-branch-btn:hover{border-color:rgba(214,255,47,.3);color:#d6ff2f}
body.op-remember-live .rem5-branch-btn.active{border-color:rgba(214,255,47,.55);color:#071009;background:#d6ff2f}
body.op-remember-live .rem5-branch-card{display:grid;grid-template-columns:.8fr 1.25fr 1.25fr;gap:8px}
body.op-remember-live .rem9-contingency{border:1px solid rgba(90,156,255,.20);background:linear-gradient(135deg,rgba(39,86,155,.07),rgba(4,8,12,.64))}body.op-remember-live .rem9-contingency>summary{cursor:pointer;list-style:none;padding:10px 11px;color:#91b9ff;font-size:7px;letter-spacing:.14em;font-weight:950;text-transform:uppercase}body.op-remember-live .rem9-contingency>summary::-webkit-details-marker{display:none}body.op-remember-live .rem9-contingency>summary:after{content:' +';float:right;color:#91b9ff}body.op-remember-live .rem9-contingency[open]>summary:after{content:' −'}body.op-remember-live .rem9-body{padding:0 10px 10px;display:grid;gap:8px}.rem9-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.rem9-btn{appearance:none;border:1px solid rgba(255,255,255,.10);background:#071019;color:#7f8f9a;padding:8px 9px;font:950 7px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}.rem9-btn:hover{border-color:rgba(113,167,255,.34);color:#a8c8ff}.rem9-btn.active{border-color:rgba(113,167,255,.55);background:#5f9fff;color:#06101a}.rem9-btn:disabled{opacity:.34;cursor:not-allowed}.rem9-card{display:grid;grid-template-columns:.85fr 1fr 1.35fr;gap:7px}.rem9-cell{padding:9px 10px;border:1px solid rgba(255,255,255,.075);background:rgba(4,8,12,.60)}.rem9-cell span{display:block;color:#687985;font-size:6px;letter-spacing:.13em;font-weight:950;text-transform:uppercase}.rem9-cell strong{display:block;margin-top:5px;color:#dfe8ee;font-size:8px;line-height:1.35;text-transform:uppercase}.rem9-cell.job strong{color:#bcd5ff}.rem9-boundary{font-size:6px;letter-spacing:.09em;color:#5d6c76;text-transform:uppercase;line-height:1.4}
body.op-remember-live .rem5-branch-cell{padding:10px 11px;border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.62);min-width:0}
body.op-remember-live .rem5-branch-cell span{display:block;color:#6e7e89;font-size:6px;letter-spacing:.15em;font-weight:950;text-transform:uppercase}
body.op-remember-live .rem5-branch-cell strong{display:block;margin-top:5px;font-size:9px;line-height:1.35;text-transform:uppercase}
body.op-remember-live .rem5-branch-cell.main strong{color:#d6ff2f;font-size:10px}
body.op-remember-live .rem5-riskline{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:8px 10px;border:1px solid rgba(255,184,76,.14);background:rgba(255,184,76,.025)}
body.op-remember-live .rem5-riskline span{color:#ffbb57;font-size:6px;letter-spacing:.14em;font-weight:950;text-transform:uppercase;white-space:nowrap}
body.op-remember-live .rem5-riskline strong{color:#d7dee3;font-size:7px;line-height:1.35;text-transform:uppercase}
body.op-remember-live .rem5-policy{font-size:6px;letter-spacing:.12em;color:#55626b;text-align:right;text-transform:uppercase}body.op-remember-live .rem5-coach-detail{border:1px solid rgba(255,255,255,.08);background:rgba(4,8,12,.42)}body.op-remember-live .rem5-coach-detail>summary{cursor:pointer;list-style:none;padding:10px 11px;color:#8997a1;font-size:7px;letter-spacing:.15em;font-weight:950;text-transform:uppercase}body.op-remember-live .rem5-coach-detail>summary::-webkit-details-marker{display:none}body.op-remember-live .rem5-coach-detail>summary:after{content:' +';float:right;color:#d6ff2f}body.op-remember-live .rem5-coach-detail[open]>summary:after{content:' −'}body.op-remember-live .rem5-coach-detail-body{padding:0 9px 9px;display:grid;gap:8px}
@media(max-width:980px){body.op-remember-live .rem4-carry-strip{grid-template-columns:1fr!important}body.op-remember-live .rem5-trap,body.op-remember-live .rem5-branch-card,body.op-remember-live .rem9-card,body.op-remember-live .rem5-premortem-list,body.op-remember-live .rem6-simulation-list,body.op-remember-live .rem7-memory,body.op-remember-live .rem8-transfer{grid-template-columns:1fr}body.op-remember-live .rem5-policy{text-align:left}}
@media(max-height:850px){body.op-remember-live #opRememberHud{min-height:760px!important}body.op-remember-live .rem4-body{grid-template-rows:94px 142px 125px 102px auto auto!important}body.op-remember-live .rem4-call strong{font-size:38px!important}}
@media(max-width:980px){body.op-remember-live #opRememberHud{min-height:auto!important}body.op-remember-live .rem4-body{display:block!important}body.op-remember-live .rem4-body>section,body.op-remember-live .rem4-body>details{margin-top:10px!important}body.op-remember-live .rem4-pick{min-height:70px!important}body.op-remember-live .rem4-call strong{font-size:38px!important}}
`;
    document.head.appendChild(style);
  }

  function loadDeepLockedPlan(){
    try{return JSON.parse(localStorage.getItem(DEEP_PLAN_STORAGE_KEY)||'null')}catch{return null}
  }

  function persistDeepLockedPlan(coach,champion,role){
    if(!coach?._playbook||coach._playbook.version!=='FROZEN_V1')return;
    const previous=loadDeepLockedPlan();
    const same=previous?.draftFingerprint&&previous.draftFingerprint===coach._playbook.draftFingerprint;
    const next={
      version:1,
      champion:clean(champion),
      role:normRole(role)||clean(role),
      source:clean(coach?._coachSource)||'rules',
      quality:coach?._coachQuality||null,
      headline:clean(coach?.headline),
      why:clean(coach?.why),
      theirPlan:clean(coach?.theirPlan),
      threatLabel:clean(coach?.threatLabel),
      threats:Array.isArray(coach?.threats)?coach.threats.map(clean).filter(Boolean).slice(0,3):[],
      threatAnswer:clean(coach?.threatAnswer),
      fightTrigger:clean(coach?.fightTrigger),
      objectiveSetup:clean(coach?.objectiveSetup),
      never:clean(coach?.never),
      laneOpponent:clean(coach?.laneOpponent),
      laneOpponents:Array.isArray(coach?.laneOpponents)?coach.laneOpponents.map(clean).filter(Boolean).slice(0,2):[],
      lanePartner:clean(coach?.lanePartner),
      playerCoachingIdentity:coach?._playerCoachingIdentity||null,
      learningVelocity:coach?._learningVelocity||null,
      skillTransferGraph:coach?._skillTransferGraph||null,
      skillBridgePrime:coach?._skillBridgePrime||null,
      decisionPrincipleEngine:coach?._decisionPrincipleEngine||null,
      decisionPrinciplePrime:coach?._decisionPrinciplePrime||null,
      adaptiveCoachingSession:coach?._adaptiveCoachingSession||null,
      personalTrap:coach?._personalTrap||null,
      decisionPremortem:coach?._decisionPremortem||coach?._playbook?.decisionPremortem||null,
      decisionSimulation:coach?._decisionSimulation||null,
      scenarioPrime:coach?._scenarioPrime||null,
      decisionTransferPrime:coach?._decisionTransferPrime||null,
      climbMission:coach?._climbMission||null,
      intentProbe:coach?._intentProbe||null,
      coachingStrategy:coach?._coachingStrategy||null,
      causalCoachRoute:coach?._causalCoachRoute||null,
      experimentSchedule:coach?._experimentSchedule||null,
      coachIntervention:coach?._coachIntervention||null,
      matchContract:coach?._matchContract||null,
      draftFingerprint:clean(coach._playbook.draftFingerprint),
      playbook:coach._playbook,
      selectedBranch:same&&previous?.selectedBranch?previous.selectedBranch:selectedBranch,
      branchSelections:same&&Array.isArray(previous?.branchSelections)?previous.branchSelections.slice(-20):[],
      selectedContingency:same&&previous?.selectedContingency?previous.selectedContingency:selectedContingency,
      contingencySelections:same&&Array.isArray(previous?.contingencySelections)?previous.contingencySelections.slice(-20):[],
      capturedAt:same&&previous?.capturedAt?previous.capturedAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    };
    try{localStorage.setItem(DEEP_PLAN_STORAGE_KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('op-climb-player-identity',{detail:next.playerCoachingIdentity||null}));window.dispatchEvent(new CustomEvent('op-climb-learning-velocity',{detail:next.learningVelocity||null}));window.dispatchEvent(new CustomEvent('op-climb-skill-transfer-graph',{detail:next.skillTransferGraph||null}));window.dispatchEvent(new CustomEvent('op-climb-adaptive-session',{detail:next.adaptiveCoachingSession||null}))}catch{}
  }

  function persistBranchSelection(branch){
    const stored=loadDeepLockedPlan();
    if(!stored?.playbook?.branches?.[branch])return;
    const history=Array.isArray(stored.branchSelections)?stored.branchSelections.slice(-19):[];
    history.push({branch,at:new Date().toISOString(),gameSeconds:Number(lastRoster?.gameTime)||null,source:'PLAYER_CLICK'});
    stored.selectedBranch=branch;
    stored.branchSelections=history;
    stored.updatedAt=new Date().toISOString();
    try{localStorage.setItem(DEEP_PLAN_STORAGE_KEY,JSON.stringify(stored))}catch{}
    emitMatchContract(lastCoach);
  }

  function persistContingencySelection(key){
    const stored=loadDeepLockedPlan();
    const item=stored?.playbook?.contingencyMap?.contingencies?.[key];
    if(!item?.available)return;
    const history=Array.isArray(stored.contingencySelections)?stored.contingencySelections.slice(-19):[];
    history.push({contingency:key,at:new Date().toISOString(),gameSeconds:Number(lastRoster?.gameTime)||null,source:'PLAYER_CLICK'});
    stored.selectedContingency=key;
    stored.contingencySelections=history;
    stored.updatedAt=new Date().toISOString();
    try{localStorage.setItem(DEEP_PLAN_STORAGE_KEY,JSON.stringify(stored))}catch{}
    emitMatchContract(lastCoach);
  }

  function ensurePlaybookPanel(){
    const hud=$('opRememberHud');if(!hud)return null;
    let panel=$('opRemFrozenPlaybook');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.id='opRemFrozenPlaybook';
    panel.className='rem5-playbook';
    panel.innerHTML=`
      <div class="rem5-playbook-head">
        <div class="rem5-playbook-title">FROZEN GAME PLAN · YOU PICK THE GAME STATE</div>
        <div id="opRemCoachStatus" class="rem5-coach-status">SAFE LOCAL PLAN</div>
      </div>
      <div id="opRemPersonalTrap" class="rem5-trap building">
        <div><span class="rem5-trap-kicker">CLIMB PROFILE</span><strong id="opRemTrapTitle" class="rem5-trap-title">BUILDING YOUR PROFILE</strong><small id="opRemTrapProof" class="rem5-trap-proof">NO PERSONAL CLAIM WITHOUT ENOUGH EVIDENCE</small></div>
        <div class="rem5-trap-copy"><span>YOUR PATTERN</span><strong id="opRemTrapCue">FOLLOW THE DRAFT PLAN WHILE OP CLIMB BUILDS REPEATED EVIDENCE.</strong></div>
      </div>
      <div id="opRemStrategy" class="rem10-strategy">
        <div><span>COACHING STRATEGY</span><strong id="opRemStrategyMode">WAITING FOR MATCH REP</strong></div>
        <p id="opRemStrategyWhy">OP CLIMB WILL DECIDE WHETHER TO TEACH, REINFORCE, DIAGNOSE OR FADE SUPPORT AFTER THE MATCH REP IS FROZEN.</p>
      </div>
      <div id="opRemCausalRoute" class="rem10-strategy">
        <div><span>CAUSAL COACH LAYER</span><strong id="opRemCausalRouteMode">BUILDING ROOT-CAUSE MEMORY</strong></div>
        <p id="opRemCausalRouteWhy">ONE MATCH CANNOT ROUTE THE COACH. REPEATED VERIFIED READ → DECISION CHAINS ARE REQUIRED.</p>
      </div>
      <div id="opRemExperiment" class="rem10-strategy">
        <div><span>EXPERIMENT SCHEDULER</span><strong id="opRemExperimentType">NO EXPERIMENT SCHEDULED</strong></div>
        <p id="opRemExperimentWhy">OP CLIMB WILL ONLY CHANGE THE SUPPORT CONDITION WHEN THE NEXT TEST IS BOTH SAFE AND INFORMATIVE.</p>
      </div>
      <div id="opRemIntent" class="rem11-intent">
        <div class="rem11-intent-head"><span>INTENT GAP · BEFORE THE COACH CUE</span><strong id="opRemIntentQuestion">NO INTENT CHECK ACTIVE</strong><small id="opRemIntentStatus">YOUR ANSWER IS FROZEN BEFORE THE COACHING CUE APPEARS</small></div>
        <div id="opRemIntentOptions" class="rem11-intent-options"></div>
      </div>
      <div class="rem5-branch-tabs" role="group" aria-label="Choose current game state">
        <button type="button" class="rem5-branch-btn" data-op-branch="AHEAD">AHEAD</button>
        <button type="button" class="rem5-branch-btn active" data-op-branch="EVEN">EVEN</button>
        <button type="button" class="rem5-branch-btn" data-op-branch="BEHIND">BEHIND</button>
      </div>
      <div class="rem5-branch-card">
        <div class="rem5-branch-cell main"><span>YOUR CALL</span><strong id="opRemBranchHeadline">WAITING FOR DEEP PLAN</strong></div>
        <div class="rem5-branch-cell"><span>FIGHT RULE</span><strong id="opRemBranchFight">USE THE BASE PLAN</strong></div>
        <div class="rem5-branch-cell"><span>OBJECTIVE RULE</span><strong id="opRemBranchObjective">USE THE BASE PLAN</strong></div>
      </div>
      <details class="rem5-coach-detail"><summary>COACH DETAIL · CONTINGENCY / RISK MAP / DECISION LAB / SKILL TRANSFER / REHEARSAL</summary><div class="rem5-coach-detail-body">
        <details id="opRemContingency" class="rem9-contingency">
          <summary id="opRemContingencySummary">FROZEN CONTINGENCY MAP · PLAN A ACTIVE · YOU CHOOSE IF IT BREAKS</summary>
          <div class="rem9-body">
            <div class="rem9-tabs" role="group" aria-label="Choose frozen contingency">
              <button type="button" class="rem9-btn active" data-op-contingency="PLAN_A">PLAN A</button>
              <button type="button" class="rem9-btn" data-op-contingency="PLAN_B">PLAN B</button>
              <button type="button" class="rem9-btn" data-op-contingency="RECOVERY">RECOVERY</button>
            </div>
            <div class="rem9-card">
              <div class="rem9-cell"><span>USE WHEN</span><strong id="opRemContingencyWhen">ORIGINAL CARRY CONDITION IS STILL PLAYABLE.</strong></div>
              <div class="rem9-cell"><span>PLAY AROUND</span><strong id="opRemContingencyPlay">ORIGINAL PLAN</strong></div>
              <div class="rem9-cell job"><span>YOUR JOB</span><strong id="opRemContingencyJob">EXECUTE PLAN A.</strong></div>
            </div>
            <div id="opRemContingencyBoundary" class="rem9-boundary">PLAYER SELECTS THIS FROM THE GAME THEY CAN SEE · OP CLIMB NEVER AUTO-SWITCHES THE WIN CONDITION.</div>
          </div>
        </details>
        <div id="opRemPremortem" class="rem5-premortem building">
          <div class="rem5-premortem-head"><span>RISK MAP</span><strong id="opRemPremortemTitle">BUILDING YOUR RISK MAP</strong><small id="opRemPremortemBoundary">EVIDENCE-BOUNDED · FROZEN BEFORE GAME</small></div>
          <div id="opRemPremortemList" class="rem5-premortem-list"></div>
        </div>
        <div id="opRemScenarioPrime" class="rem7-memory">
          <div><span class="rem7-memory-kicker">DECISION LAB · SCENARIO MEMORY</span><strong id="opRemMemoryTitle" class="rem7-memory-title">NO SPACED REP DUE</strong><small id="opRemMemoryMeta" class="rem7-memory-meta">WAITING FOR A MATCHING MEMORY</small></div>
          <div class="rem7-memory-copy"><span>ONE REP THIS GAME</span><strong id="opRemMemoryRule">PLAY THE FROZEN DRAFT PLAN.</strong></div>
          <div class="rem7-memory-proof"><span>WHY NOW</span><strong id="opRemMemoryWhy">NO MATCHING REPEATED MEMORY IS DUE.</strong></div>
        </div>
        <div id="opRemDecisionTransfer" class="rem8-transfer">
          <div><span class="rem8-transfer-kicker">CLIMB PROFILE · SKILL TRANSFER</span><strong id="opRemTransferTitle" class="rem8-transfer-title">NO TRANSFER TEST DUE</strong><small id="opRemTransferMeta" class="rem8-transfer-meta">LOCAL LEARNING COMES FIRST</small></div>
          <div class="rem8-transfer-copy"><span>APPLY THE PRINCIPLE</span><strong id="opRemTransferRule">USE THE FROZEN DRAFT PLAN.</strong></div>
          <div class="rem8-transfer-proof"><span>WHAT MAKES THIS DIFFERENT</span><strong id="opRemTransferWhy">NO NOVEL CONDITION IS READY TO TEST.</strong></div>
        </div>
        <div id="opRemDecisionSimulation" class="rem6-simulation">
          <div class="rem6-simulation-head"><span>MATCH REHEARSAL</span><strong id="opRemSimulationTitle">REHEARSE THIS DRAFT</strong><small id="opRemSimulationMeta">FROZEN BEFORE GAME</small></div>
          <div id="opRemSimulationList" class="rem6-simulation-list"></div>
        </div>
        <div class="rem5-riskline"><span>PERSONAL RISK RULE</span><strong id="opRemBranchRisk">NO VERIFIED PERSONAL RISK OVERRIDE — EXECUTE THE BASE DRAFT PLAN.</strong></div>
        <div id="opRemBranchRule" class="rem5-policy">PLAYER-SELECTED BRANCH · NEVER AUTO-CHANGED BY LIVE TELEMETRY</div>
      </div></details>`;
    const check=hud.querySelector('.rem4-check');
    if(check)check.insertAdjacentElement('beforebegin',panel);
    else hud.querySelector('.rem4-body')?.appendChild(panel);
    panel.querySelectorAll('[data-op-branch]').forEach(button=>button.addEventListener('click',()=>{
      const key=upper(button.getAttribute('data-op-branch'));
      if(!['AHEAD','EVEN','BEHIND'].includes(key)||!lastPlaybook?.branches?.[key])return;
      selectedBranch=key;
      persistBranchSelection(key);
      renderSelectedBranch();
    }));
    panel.querySelectorAll('[data-op-contingency]').forEach(button=>button.addEventListener('click',()=>{
      const key=upper(button.getAttribute('data-op-contingency'));
      const item=lastPlaybook?.contingencyMap?.contingencies?.[key];
      if(!item?.available)return;
      selectedContingency=key;
      persistContingencySelection(key);
      renderSelectedContingency();
    }));
    return panel;
  }

  function renderPersonalTrap(trap){
    ensurePlaybookPanel();
    const root=$('opRemPersonalTrap');if(!root)return;
    const status=upper(trap?.status||'BUILDING');
    const ready=status==='READY';
    const mastered=status==='MASTERED';
    root.classList.toggle('building',!ready&&!mastered);
    root.classList.toggle('mastered',mastered);
    const recurring=(ready||mastered)&&upper(trap?.source)==='SITUATION_PATTERN';
    const title=recurring
      ?[clean(trap?.title)||(mastered?'THIS USED TO CATCH YOU':"YOU'VE SEEN THIS DECISION BEFORE"),clean(trap?.behaviourLabel)].filter(Boolean).join(' · ')
      :(clean(trap?.behaviourLabel)||'VERIFIED PERSONAL PATTERN');
    set('opRemTrapTitle',ready||mastered?title:(status==='NONE'?'NO VERIFIED PERSONAL TRAP':'BUILDING YOUR CLIMB PROFILE'));
    set('opRemTrapCue',ready||mastered?(clean(trap?.cue)||'USE THE DRAFT PLAN'):(status==='NONE'?'NO RECURRING WEAKNESS MATCHED THIS DRAFT. EXECUTE THE NORMAL GAME PLAN.':'FOLLOW THE DRAFT PLAN WHILE OP CLIMB BUILDS REPEATED EVIDENCE.'));
    set('opRemTrapProof',ready||mastered?(clean(trap?.proof)||'REPEATED MATCH EVIDENCE'):(status==='NONE'?'NO FORCED PERSONALISATION':'NO PERSONAL CLAIM WITHOUT ENOUGH EVIDENCE'));
    root.title=ready||mastered?[clean(trap?.historicalSummary),clean(trap?.draftReason)].filter(Boolean).join(' · '):clean(trap?.historicalSummary||trap?.draftReason);
  }

  function renderIntentProbe(probe,coach){
    ensurePlaybookPanel();
    const root=$('opRemIntent'),options=$('opRemIntentOptions');if(!root||!options)return;
    const active=probe?.version===1&&Array.isArray(probe?.options)&&probe.options.length===2;
    root.style.display=active?'grid':'none';
    options.replaceChildren();
    if(!active)return;
    const answered=Boolean(probe?.response?.selectedOptionId);
    root.classList.toggle('answered',answered);
    set('opRemIntentQuestion',probe.prompt||'WHICH BRANCH ARE YOU PLANNING TO TAKE?');
    set('opRemIntentStatus',answered?'INTENT FROZEN · COACHING CUE UNLOCKED':'CHOOSE ONCE · YOU CANNOT CHANGE THIS AFTER THE COACHING CUE IS REVEALED');
    for(const item of probe.options){
      const button=document.createElement('button');
      button.type='button';button.className='rem11-intent-btn';button.textContent=upper(item.label||item.id);
      button.disabled=answered;
      if(answered&&probe.response?.selectedOptionId===item.id)button.classList.add('selected');
      if(!answered)button.addEventListener('click',async()=>{
        const all=[...options.querySelectorAll('button')];all.forEach(node=>node.disabled=true);
        set('opRemIntentStatus','FREEZING YOUR PRE-CUE ANSWER…');
        try{
          const result=await window.opCompanion?.answerIntentProbe?.({probeId:probe.id,optionId:item.id});
          if(!result?.ok){
            all.forEach(node=>node.disabled=false);
            set('opRemIntentStatus',result?.error||'COULD NOT FREEZE INTENT · TRY AGAIN');
            return;
          }
          const next={...probe,response:result?.probe?.response||{selectedOptionId:item.id,capturedAt:new Date().toISOString()}};
          if(coach){coach._intentProbe=next;persistDeepLockedPlan(coach,clean(coach?._playbook?.champion||lastState?.matchup?.champion),clean(coach?._resolvedRole||lastState?.matchup?.role))}
          renderIntentProbe(next,coach);
          const climbMission=coach?._climbMission||null;
          const coachIntervention=coach?._coachIntervention||null;
          set('opRemMission',coachIntervention?.primaryCue||(climbMission?.status==='READY'?(climbMission.cue||climbMission.action):'NO FORCED REP THIS DRAFT · EXECUTE THE FROZEN GAME PLAN'));
        }catch{
          all.forEach(node=>node.disabled=false);
          set('opRemIntentStatus','COULD NOT FREEZE INTENT · TRY AGAIN');
        }
      });
      options.appendChild(button);
    }
    if(!answered){
      const skip=document.createElement('button');
      skip.type='button';skip.className='rem11-intent-btn';skip.textContent='SKIP · SHOW COACHING CUE';
      skip.addEventListener('click',()=>{
        skippedIntentProbeId=probe.id;
        root.classList.add('answered');
        set('opRemIntentStatus','INTENT CHECK SKIPPED · NO KNOWLEDGE/EXECUTION DIAGNOSIS WILL BE CREATED');
        const climbMission=coach?._climbMission||null;
        const coachIntervention=coach?._coachIntervention||null;
        set('opRemMission',coachIntervention?.primaryCue||(climbMission?.status==='READY'?(climbMission.cue||climbMission.action):'NO FORCED REP THIS DRAFT · EXECUTE THE FROZEN GAME PLAN'));
        [...options.querySelectorAll('button')].forEach(node=>node.disabled=true);
        skip.classList.add('selected');
        emitMatchContract(coach);
      });
      options.appendChild(skip);
    }
  }

  function renderCoachingStrategy(strategy){
    ensurePlaybookPanel();
    const root=$('opRemStrategy');if(!root)return;
    const mode=upper(strategy?.mode||'BUILDING');
    root.classList.toggle('fade',mode==='FADE');
    root.classList.toggle('diagnose',mode==='DIAGNOSE');
    set('opRemStrategyMode',strategy?.title||(mode==='BUILDING'?'WAITING FOR MATCH REP':mode));
    set('opRemStrategyWhy',strategy?.decision||'OP CLIMB WILL DECIDE WHETHER THIS REP NEEDS EXPLICIT TEACHING, LIGHT REINFORCEMENT, DIAGNOSIS OR LESS SUPPORT.');
    root.title=[clean(strategy?.playerMessage),clean(strategy?.coachDirective),clean(strategy?.successDefinition),clean(strategy?.boundary)].filter(Boolean).join(' · ');
  }

  function renderCausalCoachRoute(route){
    ensurePlaybookPanel();
    const root=$('opRemCausalRoute');if(!root)return;
    const active=Boolean(route?.active);
    const layer=upper(route?.sourceLayerLabel||'BUILDING ROOT-CAUSE MEMORY');
    const mode=upper(String(route?.mode||'EVIDENCE_BUILD').replace(/_/g,' '));
    root.classList.toggle('fade',mode==='AUTONOMY TEST');
    root.classList.toggle('diagnose',mode==='RECOGNITION FIRST'||mode==='RECOGNITION RETEST');
    root.style.opacity=active?'1':'.72';
    set('opRemCausalRouteMode',active?layer+' · '+mode:'BUILDING ROOT-CAUSE MEMORY');
    set('opRemCausalRouteWhy',clean(route?.pregameDirective)||'ONE MATCH CANNOT ROUTE THE COACH. REPEATED VERIFIED READ → DECISION CHAINS ARE REQUIRED.');
    root.title=[clean(route?.evidence),clean(route?.liveDirective),route?.safetyConstrained?'SAFETY CONSTRAINT KEPT MORE SUPPORT ACTIVE':'',clean(route?.boundary)].filter(Boolean).join(' · ');
  }

  function renderExperimentSchedule(experiment){
    ensurePlaybookPanel();
    const root=$('opRemExperiment');if(!root)return;
    const status=upper(experiment?.status||'NONE');
    const type=upper(experiment?.experimentType||'NO_EXPERIMENT').replace(/_/g,' ');
    root.classList.toggle('fade',experiment?.requestedDeliveryPolicy==='NONE');
    root.classList.toggle('diagnose',experiment?.requestedDeliveryPolicy==='DIAGNOSTIC');
    root.style.opacity=status==='DEFERRED'?'.72':'1';
    set('opRemExperimentType',status==='DEFERRED'?'DEFERRED · '+type:status==='SCHEDULED'?type:'NO EXPERIMENT SCHEDULED');
    set('opRemExperimentWhy',clean(experiment?.informationNeed)||'OP CLIMB WILL ONLY CHANGE THE SUPPORT CONDITION WHEN THE NEXT TEST IS BOTH SAFE AND INFORMATIVE.');
    root.title=[clean(experiment?.hypothesis),clean(experiment?.safetyReason),clean(experiment?.successRead),clean(experiment?.boundary)].filter(Boolean).join(' · ');
  }


  function renderDecisionPremortem(premortem){
    ensurePlaybookPanel();
    const root=$('opRemPremortem'),list=$('opRemPremortemList');if(!root||!list)return;
    const status=upper(premortem?.status||'BUILDING');
    const ready=status==='READY'&&Array.isArray(premortem?.risks)&&premortem.risks.length;
    root.classList.toggle('building',!ready);
    list.replaceChildren();
    set('opRemPremortemTitle',ready?(premortem?.headline||'YOUR HIGHEST-RISK DECISION WINDOWS'):(status==='NONE'?'NO VERIFIED PERSONAL RISK WINDOW':'BUILDING YOUR RISK MAP'));
    const boundary=$('opRemPremortemBoundary');
    if(boundary)boundary.textContent=ready?'PRIORITY ≠ PROBABILITY · FROZEN BEFORE GAME':(status==='NONE'?'NO FORCED PREDICTION':'MORE REPEATED EVIDENCE REQUIRED');
    if(!ready){
      const card=document.createElement('article');card.className='rem5-risk';
      const label=document.createElement('span');label.textContent=status==='NONE'?'NORMAL DRAFT PLAN':'CLIMB PROFILE';
      const title=document.createElement('b');title.textContent=status==='NONE'?'NO PERSONAL RISK CLAIM':'PRE-MORTEM NOT READY';
      const copy=document.createElement('p');copy.textContent=clean(premortem?.summary)||(status==='NONE'?'This draft did not match a strong repeated personal pattern.':'OP CLIMB is collecting enough comparable decisions to rank risks safely.');
      card.append(label,title,copy);list.appendChild(card);return;
    }
    premortem.risks.slice(0,3).forEach((risk,index)=>{
      const card=document.createElement('article');card.className='rem5-risk';
      const label=document.createElement('span');label.textContent='RISK #'+String(risk?.rank||index+1)+' · '+(clean(risk?.behaviourLabel)||'DECISION');
      const title=document.createElement('b');title.textContent=clean(risk?.title)||'PERSONAL DECISION WINDOW';
      const trigger=document.createElement('p');trigger.textContent='TRIGGER · '+(clean(risk?.trigger)||'Before the next major commit.');
      const prevent=document.createElement('em');prevent.textContent='PREVENT · '+(clean(risk?.preventionRule)||'Use the frozen draft plan.');
      card.title=clean(risk?.evidence)||'Repeated decision evidence';
      card.append(label,title,trigger,prevent);list.appendChild(card);
    });
  }

  function renderScenarioPrime(prime){
    ensurePlaybookPanel();
    const root=$('opRemScenarioPrime');if(!root)return;
    const active=prime&&clean(prime?.memoryId);
    root.style.opacity=active?'1':'.66';
    set('opRemMemoryTitle',active?(prime?.title||'ONE REP THIS GAME'):'NO SPACED REP DUE');
    set('opRemMemoryMeta',active?((prime?.state||'LEARNING')+' · '+String(prime?.memoryStrength??0)+'/100 MEMORY · '+(prime?.confidence||'LOW')):'WAITING FOR A MATCHING MEMORY');
    set('opRemMemoryRule',active?(prime?.targetBranch||'USE THE CLEANER BRANCH.'):'PLAY THE FROZEN DRAFT PLAN.');
    set('opRemMemoryWhy',active?(prime?.dueReason||prime?.exactDraftRead||'THIS MEMORY MATCHES THE CURRENT DRAFT.'):'NO MATCHING REPEATED MEMORY IS DUE.');
    root.title=active?[clean(prime?.trigger),clean(prime?.oldBranch),clean(prime?.evidence),clean(prime?.boundary)].filter(Boolean).join(' · '):'';
  }

  function renderDecisionTransfer(prime){
    ensurePlaybookPanel();
    const root=$('opRemDecisionTransfer');if(!root)return;
    const active=prime&&clean(prime?.transferId);
    root.style.opacity=active?'1':'.58';
    set('opRemTransferTitle',active?(prime?.title||'TRANSFER TEST'):'NO TRANSFER TEST DUE');
    set('opRemTransferMeta',active?((prime?.dimension||'CONTEXT')+' · '+String(prime?.transferStrength??0)+'/100 TRANSFER · '+(prime?.state||'TESTING')):'LOCAL LEARNING COMES FIRST');
    set('opRemTransferRule',active?(prime?.targetMove||prime?.principle||'APPLY THE LEARNED PRINCIPLE.'):'USE THE FROZEN DRAFT PLAN.');
    set('opRemTransferWhy',active?(prime?.exactDraftRead||prime?.whyNow||'THIS DRAFT TESTS THE PRINCIPLE UNDER A DIFFERENT CONDITION.'):'NO NOVEL CONDITION IS READY TO TEST.');
    root.title=active?[clean(prime?.trigger),clean(prime?.whyNow),clean(prime?.evidence),clean(prime?.boundary)].filter(Boolean).join(' · '):'';
  }

  function renderDecisionSimulation(simulation){
    ensurePlaybookPanel();
    const root=$('opRemDecisionSimulation'),list=$('opRemSimulationList');if(!root||!list)return;
    const ready=upper(simulation?.status)==='READY'&&Array.isArray(simulation?.scenarios)&&simulation.scenarios.length;
    list.replaceChildren();
    set('opRemSimulationTitle',ready?(simulation?.headline||'DECISION SIMULATION · REHEARSE THIS DRAFT'):'DECISION SIMULATION IS BUILDING');
    set('opRemSimulationMeta',ready?String(simulation?.personalForecastCount||0)+' PERSONAL · '+String(simulation?.draftRehearsalCount||0)+' DRAFT':'NO FORCED PERSONAL PREDICTION');
    if(!ready){
      const card=document.createElement('article');card.className='rem6-sim-card';
      const label=document.createElement('span');label.textContent='DRAFT REHEARSAL';
      const title=document.createElement('b');title.textContent='MORE EVIDENCE REQUIRED';
      const copy=document.createElement('p');copy.textContent=clean(simulation?.summary)||'OP CLIMB will rehearse the exact draft without inventing a personal prediction.';
      card.append(label,title,copy);list.appendChild(card);return;
    }
    simulation.scenarios.slice(0,5).forEach((scenario,index)=>{
      const personal=upper(scenario?.source)==='PERSONAL_RISK';
      const card=document.createElement('article');card.className='rem6-sim-card'+(personal?' personal':'');
      const label=document.createElement('span');label.textContent='SIM #'+String(scenario?.rank||index+1)+' · '+(personal?'PERSONAL FORECAST':'DRAFT REHEARSAL');
      const title=document.createElement('b');title.textContent=clean(scenario?.title)||clean(scenario?.behaviourLabel)||'DECISION TEST';
      const trigger=document.createElement('p');trigger.textContent='TRIGGER · '+(clean(scenario?.trigger)||'Before the next major commit.');
      const target=document.createElement('em');target.textContent='WIN BRANCH · '+(clean(scenario?.targetMove)||'Use the frozen plan.');
      card.title=[clean(scenario?.exactDraftRead),clean(scenario?.twinLikelyMove),clean(scenario?.evidence)].filter(Boolean).join(' · ');
      card.append(label,title,trigger,target);list.appendChild(card);
    });
  }

  function renderCoachStatus(meta){
    ensurePlaybookPanel();
    const node=$('opRemCoachStatus');if(!node)return;
    const source=clean(meta?.source||lastCoachMeta?.source||'local').toLowerCase();
    const quality=meta?.quality||lastCoachMeta?.quality||null;
    const failure=meta?.failure||lastCoachMeta?.failure||null;
    const tier=upper(quality?.tier||quality?.rank||'');
    const verified=source==='ai'&&quality?.pass===true&&!failure;
    node.classList.toggle('verified',verified);
    if(failure){
      const code=upper(failure?.code);
      const label=code==='QUALITY_GATE'?'QUALITY GATE · SAFE PLAN'
        :code==='RATE_LIMIT'?'COACH BUSY · SAFE PLAN'
        :code==='ENTITLEMENT'?'PLUS / PRO REQUIRED'
        :code==='AUTH'||code==='PAIR_REQUIRED'?'RE-PAIR REQUIRED'
        :code==='DRAFT_WAITING'?'WAITING FOR FULL DRAFT'
        :code==='TIMEOUT'||code==='NETWORK'?'OFFLINE · SAFE PLAN'
        :'DEEP COACH UNAVAILABLE · SAFE PLAN';
      node.textContent=label;
      node.title=clean(failure?.error)||label;
      return;
    }
    node.title='';
    node.textContent=source==='loading'?'DEEP COACH CHECKING…'
      :verified?('DEEP VERIFIED'+(tier?' · '+tier:''))
      :source==='rules'?('RULE PLAN'+(tier?' · '+tier:''))
      :'SAFE LOCAL PLAN';
  }

  function applySelectedContingencyOverlay(){
    const map=lastPlaybook?.contingencyMap||null;
    const item=map?.contingencies?.[selectedContingency]||null;
    if(!item?.available||selectedContingency==='PLAN_A')return;
    set('opRemCarryPrimary',item.resourceOwner||map?.primaryCarry||'YOUR CARRY');
    set('opRemCarryPlay',item.playAround||'FROZEN CONTINGENCY');
    set('opRemGameCall',item.job||'USE THE FROZEN CONTINGENCY');
    set('opRemGameCallWhy',(item.label||selectedContingency)+' · PLAYER SELECTED · FROZEN BEFORE GAME');
    if(item.priority&&item.priority!=='ORIGINAL')set('opRemDecisionCall',item.priority);
    set('opRemFightWhen',item.fightWhen||'USE THE PREWRITTEN FIGHT RULE');
    set('opRemStopRule',item.never||'DO NOT FORCE THE ORIGINAL PLAN');
    set('opRemBranchFight',item.fightWhen||'USE THE PREWRITTEN FIGHT RULE');
    set('opRemBranchObjective',item.objective||'USE THE PREWRITTEN OBJECTIVE RULE');
  }

  function renderSelectedContingency(){
    ensurePlaybookPanel();
    const map=lastPlaybook?.contingencyMap||null;
    const options=map?.contingencies||null;
    if(!options){
      selectedContingency='PLAN_A';
      set('opRemContingencyWhen','WAITING FOR FROZEN CONTINGENCY MAP');
      set('opRemContingencyPlay','ORIGINAL PLAN');
      set('opRemContingencyJob','EXECUTE PLAN A');
      return;
    }
    const stored=loadDeepLockedPlan();
    if(stored?.draftFingerprint===lastPlaybook?.draftFingerprint&&options?.[stored?.selectedContingency]?.available){
      selectedContingency=upper(stored.selectedContingency);
    }
    if(!options?.[selectedContingency]?.available)selectedContingency='PLAN_A';
    document.querySelectorAll('[data-op-contingency]').forEach(button=>{
      const key=upper(button.getAttribute('data-op-contingency'));
      const available=Boolean(options?.[key]?.available);
      button.disabled=!available;
      button.classList.toggle('active',key===selectedContingency);
      if(key==='PLAN_B'&&!available)button.title='NO STRONG SECONDARY CARRY WAS IDENTIFIED FROM CHAMPION SELECT';
    });
    const item=options[selectedContingency];
    set('opRemContingencySummary','FROZEN CONTINGENCY MAP · '+selectedContingency.replace('_',' ')+' ACTIVE · YOU CHOOSE IF IT BREAKS');
    set('opRemContingencyWhen',item?.when||'USE THE ORIGINAL PLAN');
    set('opRemContingencyPlay',item?.playAround||item?.resourceOwner||'ORIGINAL PLAN');
    set('opRemContingencyJob',item?.job||'EXECUTE THE FROZEN PLAN');
    const boundary=$('opRemContingencyBoundary');
    if(boundary)boundary.textContent=clean(map?.boundary)||'PLAYER SELECTS THE CONTINGENCY · OP CLIMB NEVER AUTO-SWITCHES.';
    renderSelectedBranch();
  }

  function renderSelfChecks(playbook){
    const root=$('opRemChecks');if(!root||!Array.isArray(playbook?.checkpoints))return;
    root.replaceChildren();
    playbook.checkpoints.slice(0,3).forEach(check=>{
      const card=document.createElement('article');card.className='rem4-check-card';
      const title=document.createElement('b');title.textContent=(Number(check?.minute)||'')+' MIN · READ IT YOURSELF';
      const copy=document.createElement('p');
      copy.textContent=(Array.isArray(check?.questions)?check.questions:[]).map(clean).filter(Boolean).join(' · ');
      card.append(title,copy);root.appendChild(card);
    });
  }

  function renderSelectedBranch(){
    ensurePlaybookPanel();
    const branch=lastPlaybook?.branches?.[selectedBranch]||null;
    document.querySelectorAll('[data-op-branch]').forEach(button=>button.classList.toggle('active',upper(button.getAttribute('data-op-branch'))===selectedBranch));
    if(!branch){
      set('opRemBranchHeadline','WAITING FOR DEEP PLAN');
      set('opRemBranchFight','USE THE BASE PLAN');
      set('opRemBranchObjective','USE THE BASE PLAN');
      set('opRemBranchRisk','NO VERIFIED PERSONAL RISK OVERRIDE — EXECUTE THE BASE DRAFT PLAN.');
      const rule=$('opRemBranchRule');if(rule)rule.textContent='PLAYER-SELECTED BRANCH · NEVER AUTO-CHANGED BY LIVE TELEMETRY';
      return;
    }
    set('opRemBranchHeadline',branch.headline||selectedBranch);
    set('opRemBranchFight',branch.fight||branch.rule||'USE THE BASE PLAN');
    set('opRemBranchObjective',branch.objective||'USE THE BASE OBJECTIVE PLAN');
    set('opRemBranchRisk',branch.decisionRisk||'NO VERIFIED PERSONAL RISK OVERRIDE — EXECUTE THE BASE DRAFT PLAN.');
    set('opRemGameCall',branch.job||branch.headline||selectedBranch);
    const carry=lastPlaybook?.carryMap||null;
    renderCarryMap(carry);
    set('opRemGameCallWhy',(clean(carry?.playerLabel)?carry.playerLabel+' · ':'')+selectedBranch+' BRANCH · FROZEN BEFORE GAME');
    set('opRemDecisionCall',branch.priority||'SET UP');
    set('opRemFightWhen',branch.fightWhen||branch.fight||'USE THE BASE FIGHT RULE');
    set('opRemStopRule',branch.stop||branch.never||'DO NOT FORCE THE WRONG FIGHT');
    applySelectedContingencyOverlay();
    const rule=$('opRemBranchRule');
    if(rule)rule.textContent=upper(branch.rule||'PLAYER CHOOSES THIS PREWRITTEN BRANCH')+' · NEVER AUTO-CHANGED';
  }

  function renderPlaybook(playbook,meta){
    lastCoachMeta={source:clean(meta?.source)||'local',quality:meta?.quality||null,failure:meta?.failure||null};
    renderCoachStatus(lastCoachMeta);
    if(playbook?.version==='FROZEN_V1'&&playbook?.branches){
      lastPlaybook=playbook;
      renderCarryMap(playbook.carryMap||null);
      if(!lastPlaybook.branches[selectedBranch])selectedBranch='EVEN';
      const stored=loadDeepLockedPlan();
      if(stored?.draftFingerprint===playbook.draftFingerprint&&playbook?.contingencyMap?.contingencies?.[stored?.selectedContingency]?.available)selectedContingency=upper(stored.selectedContingency);
      else selectedContingency='PLAN_A';
      renderSelectedBranch();
      renderSelectedContingency();
      renderSelfChecks(playbook);
      return;
    }
    if(!lastPlaybook)renderSelectedBranch();
  }

  function playerRole(player){return normRole(player?.position||player?.role)}
  function sorted(players){return [...players].sort((a,b)=>(ROLE_ORDER[playerRole(a)]??9)-(ROLE_ORDER[playerRole(b)]??9))}
  function stateRoster(side){
    const direct=Array.isArray(lastState?.teamPlan?.[side])?lastState.teamPlan[side]:[];
    const frozen=side==='ourTeam'
      ?(Array.isArray(lastState?.teamPlan?.rememberPlan?.draftTeams?.ours)?lastState.teamPlan.rememberPlan.draftTeams.ours:[])
      :(Array.isArray(lastState?.teamPlan?.rememberPlan?.draftTeams?.theirs)?lastState.teamPlan.rememberPlan.draftTeams.theirs:[]);
    const source=direct.length?direct:frozen;
    return source.map(p=>({champion:clean(p?.champion||p?.name),role:normRole(p?.position||p?.role)})).filter(p=>p.champion);
  }
  function inferMissingTeamRole(players){
    const used=new Set(players.map(playerRole).filter(Boolean));
    const unresolved=players.filter(p=>!playerRole(p));
    const remaining=VALID_ROLES.filter(role=>!used.has(role));
    if(unresolved.length===1&&remaining.length===1)unresolved[0].position=remaining[0];
    return players;
  }
  function repairTeam(raw,side,champion,forcedRole){
    const frozen=stateRoster(side);
    const frozenRole=name=>playerRole(frozen.find(p=>clean(p.champion).toLowerCase()===clean(name).toLowerCase()));
    const map=new Map();
    for(const p of raw){
      const name=clean(p?.champion);if(!name)continue;
      const key=name.toLowerCase();
      const next={...p,champion:name,position:playerRole(p)||frozenRole(name)||''};
      const current=map.get(key);
      if(!current||(!playerRole(current)&&playerRole(next)))map.set(key,next);
    }
    for(const p of frozen){
      const key=clean(p.champion).toLowerCase();
      if(!map.has(key)&&map.size<5)map.set(key,{champion:p.champion,team:'',position:playerRole(p)});
    }
    const list=[...map.values()];
    if(side==='ourTeam'&&champion){
      const me=list.find(p=>clean(p.champion).toLowerCase()===clean(champion).toLowerCase());
      if(me&&forcedRole)me.position=forcedRole;
    }
    return inferMissingTeamRole(list.slice(0,5));
  }
  function localCarryScore(player){
    const role=playerRole(player);const name=clean(player?.champion);let score=role==='ADC'?48:role==='MID'?35:role==='JUNGLE'?29:role==='TOP'?27:role==='SUPPORT'?8:20;
    if(HYPER_CARRY.has(name))score+=28;
    if(SCALERS.has(name))score+=17;
    if(SIDE_CARRY.has(name))score+=17;
    if(role==='JUNGLE'&&CARRY_JUNGLE.has(name))score+=20;
    if(PEEL.has(name))score-=14;
    if(FRONTLINE.has(name))score-=16;
    if(role==='SUPPORT')score-=8;
    return Math.max(0,Math.min(100,score));
  }
  function localCarryMap(champion,ours,enemies,threat){
    const ranked=[...ours].sort((a,b)=>localCarryScore(b)-localCarryScore(a));
    const enemyRanked=[...enemies].sort((a,b)=>localCarryScore(b)-localCarryScore(a));
    const primary=ranked[0]||{champion};
    const secondary=ranked.find(p=>clean(p?.champion)!==clean(primary?.champion))||null;
    const me=ranked.find(p=>clean(p?.champion).toLowerCase()===clean(champion).toLowerCase())||{champion,position:''};
    let playerLabel='ENABLER';
    if(clean(me?.champion)===clean(primary?.champion))playerLabel='PRIMARY CARRY';
    else if(secondary&&clean(me?.champion)===clean(secondary?.champion)&&localCarryScore(me)>=34)playerLabel='SECONDARY CARRY';
    else if(PEEL.has(clean(me?.champion))||FRONTLINE.has(clean(me?.champion))||playerRole(me)==='SUPPORT')playerLabel='THREAT DENIAL';
    const primaryName=clean(primary?.champion)||champion||'YOUR CARRY';
    const mainThreat=clean(threat)||clean(enemyRanked[0]?.champion)||'THEIR MAIN THREAT';
    const playerJob=playerLabel==='PRIMARY CARRY'
      ?'TAKE SAFE RESOURCES → HIT YOUR SPIKE → STAY ALIVE'
      :playerLabel==='SECONDARY CARRY'
        ?'KEEP YOUR SPIKE → CONNECT TO '+primaryName
        :playerLabel==='THREAT DENIAL'
          ?'KEEP '+primaryName+' SAFE → DENY '+mainThreat
          :'CREATE SPACE FOR '+primaryName+' → CONNECT FIRST';
    return{
      primary:{champion:primaryName},
      secondary:secondary?{champion:clean(secondary.champion)}:null,
      enemyPrimary:enemyRanked[0]?{champion:clean(enemyRanked[0].champion)}:null,
      playerLabel,
      resourceOwner:primaryName,
      playAround:playerLabel==='THREAT DENIAL'?primaryName+' / DENY '+mainThreat:primaryName,
      playerJob,
      reason:playerLabel==='PRIMARY CARRY'?'YOU ARE THE DRAFT RESOURCE PRIORITY':primaryName+' IS THE DRAFT RESOURCE PRIORITY',
    };
  }
  function renderCarryMap(map){
    if(!map)return;
    set('opRemCarryPrimary',map?.primary?.champion||map?.resourceOwner||'YOUR CARRY');
    set('opRemCarryRole',map?.playerLabel||'ENABLER');
    set('opRemCarryPlay',map?.playAround||map?.resourceOwner||'YOUR TEAM PLAN');
  }

  function scoreThreat(player,userRole){
    const name=clean(player?.champion);const role=playerRole(player);let score=0;
    if(ASSASSINS.has(name))score+=8;
    if(HARD_ENGAGE.has(name))score+=7;
    if(DIVERS.has(name))score+=6;
    if(ZONE_CONTROL.has(name))score+=2;
    if(userRole==='ADC'&&role&&role!=='ADC')score+=1;
    return score;
  }
  function byRole(players,role){return players.find(p=>playerRole(p)===role)?.champion||''}
  function localCoach(champion,userRole,ours,enemies){
    const ordered=[...enemies].sort((a,b)=>scoreThreat(b,userRole)-scoreThreat(a,userRole));
    const access=ordered.filter(p=>scoreThreat(p,userRole)>=6).slice(0,3);
    const threats=(access.length?access:ordered.slice(0,1)).map(p=>p.champion);
    const zones=enemies.filter(p=>ZONE_CONTROL.has(clean(p.champion)));
    const aoe=enemies.filter(p=>AOE_CARRY.has(clean(p.champion)));
    const enemyAdc=byRole(enemies,'ADC');
    const laneOpponent=byRole(enemies,userRole)||((userRole==='ADC'||userRole==='SUPPORT')?enemyAdc:'');
    const protectors=ours.filter(p=>clean(p.champion)!==champion&&(PEEL.has(clean(p.champion))||playerRole(p)==='SUPPORT')).slice(0,2).map(p=>p.champion);
    const pickTools=ours.filter(p=>PICK.has(clean(p.champion))).map(p=>p.champion);
    const stayWith=protectors.length?protectors.join(' / '):'YOUR PEEL / FRONT LINE';
    if(userRole==='ADC'&&access.length>=2){
      const accessText=threats.join(' / ');
      const setup=[...new Set([...zones,...aoe].map(p=>p.champion).filter(name=>!threats.includes(name)))].slice(0,2);
      return{
        headline:SCALERS.has(champion)?'SURVIVE FIRST DIVE → FREE-HIT':'ABSORB ENTRY → DPS',
        why:`${accessText} MUST CROSS ${stayWith} TO REACH ${champion}; IF YOU KEEP RANGE THROUGH FIRST CONTACT, THEIR ACCESS WINDOW EXPIRES BEFORE YOUR DPS DOES`,
        threatLabel:'ACCESS PACKAGE',
        threats,
        threatAnswer:`HOLD POSITION BEHIND ${stayWith} · DO NOT SPEND FLASH / PEEL BEFORE ${accessText} COMMIT`,
        laneOpponent,
        never:enemyAdc?`DO NOT WALK THROUGH THEIR THREAT LINE JUST TO REACH ${enemyAdc}`:'DO NOT WALK PAST YOUR FRONT LINE FOR A BACK-LINE TARGET',
        ifBehind:'CLEAR THE SAFEST WAVE → GROUP EARLY → MAKE THEM ENTER YOUR RANGE',
        steps:[
          {label:'1 · ECONOMY',value:SCALERS.has(champion)?'REACH 2 ITEMS WITHOUT DONATING ACCESS KILLS':'COMPLETE YOUR NEXT DAMAGE ITEM'},
          {label:'2 · POSITION',value:`PLAY BEHIND ${stayWith} · KEEP FLASH FOR SECOND ACCESS`},
          {label:'3 · ABSORB',value:`${accessText} COMMIT → KITE BACK / LET FRONT EDGE TAKE FIRST CONTACT`},
          {label:'4 · DPS',value:'HIT CLOSEST SAFE TARGET → ADVANCE ONLY AS THEIR ACCESS DISAPPEARS'},
          {label:'5 · CONVERT',value:setup.length?`ARRIVE FIRST → DENY ${setup.join(' / ')} SETUP → OBJECTIVE`:'WIN FRONT-TO-BACK → DRAGON / BARON'},
        ],
      };
    }
    if(userRole==='ADC'&&pickTools.length>=2){
      return{
        headline:'PICK FIRST → DPS THE 5V4',
        why:`${pickTools.slice(0,2).join(' / ')} CREATE THE NUMBERS EDGE; YOU DO NOT NEED A FAIR 5V5`,
        threatLabel:'MAIN ACCESS THREAT',
        threats,
        threatAnswer:`STAY CONNECTED TO ${stayWith} · LET THE PICK HAPPEN BEFORE YOU WALK FORWARD`,
        laneOpponent,
        never:enemyAdc?`DO NOT STEP PAST THE SAFE DAMAGE LINE TO REACH ${enemyAdc}`:'DO NOT OPEN THE FIGHT BY WALKING INTO THEIR FRONT LINE',
        ifBehind:'SAFE WAVES → PLAY FOG WITH YOUR TEAM → TAKE THE FIRST CLEAN PICK',
        steps:[
          {label:'1 · ECONOMY',value:'FARM YOUR ITEM WINDOW'},
          {label:'2 · LINK',value:`PLAY WITH ${pickTools.slice(0,2).join(' / ')}`},
          {label:'3 · CREATE',value:'CONTROL VISION → CATCH ONE PLAYER'},
          {label:'4 · FIGHT',value:'DPS CLOSEST SAFE TARGET IN THE 5V4'},
          {label:'5 · CONVERT',value:'PICK → DRAGON / BARON / TOWER'},
        ],
      };
    }
    if(userRole==='ADC'){
      return{
        headline:SCALERS.has(champion)?'FARM SPIKE → FRONT-TO-BACK':'PLAY CONNECTED FRONT-TO-BACK',
        why:'YOUR DAMAGE WINS WHEN YOU SURVIVE FIRST CONTACT AND KEEP HITTING WHAT IS REACHABLE',
        threatLabel:'MAIN ACCESS THREAT',
        threats,
        threatAnswer:`STAY WITH ${stayWith} · PRESERVE RANGE · DPS AFTER FIRST CONTACT`,
        laneOpponent,
        never:enemyAdc?`DO NOT WALK PAST THE ENEMY FRONT LINE JUST TO REACH ${enemyAdc}`:'DO NOT TRADE POSITION FOR A BACK-LINE TARGET',
        ifBehind:'SAFE WAVES → GROUP ON YOUR NEXT ITEM → LET THEM WALK INTO YOUR RANGE',
        steps:[
          {label:'1 · ECONOMY',value:SCALERS.has(champion)?'7+ CS/MIN → FIRST 2 ITEMS':'FARM CLEAN → NEXT ITEM'},
          {label:'2 · POSITION',value:`STAY WITH ${stayWith}`},
          {label:'3 · SURVIVE',value:`TRACK ${threats.join(' / ')}`},
          {label:'4 · FIGHT',value:'DPS CLOSEST SAFE TARGET'},
          {label:'5 · CONVERT',value:'WON FIGHT → DRAGON / BARON / TOWER'},
        ],
      };
    }
    return{
      headline:pickTools.length>=2?'PICK FIRST → CONVERT':access.length>=2?'DENY THEIR DIVE → COUNTER':'WIN SETUP → TAKE THE FIGHT',
      why:access.length>=2?`THEIR CLEANEST WIN IS ${threats.join(' / ')} REACHING YOUR CARRIES BEFORE YOUR TEAM IS SET`:'WIN THE SPACE BEFORE THE FIGHT, THEN MAKE ONE CONNECTED CALL',
      threatLabel:access.length>=2?'ACCESS PACKAGE':'MAIN THREAT',
      threats,
      threatAnswer:access.length>=2?`MARK ${threats.join(' / ')} · HOLD CONTROL UNTIL THEY COMMIT`:'TRACK THEIR FIRST CLEAN ENGAGE BEFORE COMMITTING',
      laneOpponent,
      never:'DO NOT START A DISCONNECTED FIGHT YOUR TEAM CANNOT FOLLOW',
      ifBehind:'CLEAR SAFE RESOURCES → GROUP EARLY → FIGHT FROM NUMBERS / VISION / FIRST DAMAGE',
      steps:[
        {label:'1 · SETUP',value:'FARM / RESET CLEANLY BEFORE OBJECTIVE'},
        {label:'2 · LINK',value:'PLAY WITH YOUR STRONGEST ENGAGE / CARRY PAIR'},
        {label:'3 · DENY',value:`STOP ${threats.join(' / ')} GETTING THEIR FIGHT`},
        {label:'4 · EXECUTE',value:pickTools.length>=2?'CATCH ONE → COLLAPSE TOGETHER':'ONE FIRST-CONTACT CALL → FOCUS SAME FIGHT'},
        {label:'5 · CONVERT',value:'WON FIGHT / PICK → OBJECTIVE → RESET'},
      ],
    };
  }

  function renderTeam(rootId,players,threatName){
    const root=$(rootId);if(!root)return;
    root.replaceChildren();
    const dangerNames=(Array.isArray(threatName)?threatName:[threatName]).map(name=>clean(name).toLowerCase()).filter(Boolean);
    const list=sorted(players).slice(0,5);
    for(let i=0;i<5;i++){
      const p=list[i];
      const card=document.createElement('article');
      const localChampion=clean(lastState?.matchup?.champion||lastState?.matchup?.plan?.you?.name||lastState?.teamPlan?.rememberPlan?.champion).toLowerCase();
      const isYou=Boolean(p&&rootId==='opRemOurTeam'&&clean(p.champion).toLowerCase()===localChampion);
      card.className=`rem4-pick${p&&dangerNames.includes(clean(p.champion).toLowerCase())?' threat':''}${isYou?' you':''}`;
      if(p){
        const img=document.createElement('img');img.src=tile(p.champion);img.alt='';img.loading='eager';
        const copy=document.createElement('div');copy.className='rem4-pick-copy';
        const role=document.createElement('span');role.className='rem4-pick-role';role.textContent=[playerRole(p)||'ROLE',Number(p.level)>0?'LV '+String(p.level):''].filter(Boolean).join(' · ');
        const name=document.createElement('b');name.className='rem4-pick-name';name.textContent=upper(p.champion)+(isYou?' · YOU':'');
        const spells=Array.isArray(p.summonerSpells)?p.summonerSpells.filter(Boolean).join(' + '):'';
        const items=Array.isArray(p.items)?p.items.map(item=>clean(item?.displayName)).filter(Boolean).slice(0,6).join(' · '):'';
        card.title=[spells&&('SUMMONERS: '+spells),items&&('VISIBLE ITEMS: '+items)].filter(Boolean).join(' | ');
        copy.append(role,name);card.append(img,copy);
      }else{
        const copy=document.createElement('div');copy.className='rem4-pick-copy';
        const role=document.createElement('span');role.className='rem4-pick-role';role.textContent='';
        const name=document.createElement('b');name.className='rem4-pick-name';name.textContent='DETECTING…';
        copy.append(role,name);card.append(copy);
      }
      root.appendChild(card);
    }
  }

  function renderCoachPath(steps){
    const cards=[...document.querySelectorAll('#opRememberHud .rem4-step')];
    const list=Array.isArray(steps)?steps.slice(0,5):[];
    for(let i=0;i<Math.min(cards.length,list.length);i++){
      const label=cards[i].querySelector('i');
      const value=cards[i].querySelector('strong');
      if(label&&clean(list[i]?.label))label.textContent=upper(list[i].label);
      if(value&&clean(list[i]?.value))value.textContent=upper(list[i].value);
    }
  }

  function coachPriority(coach){
    const text=upper([coach?.headline,coach?.why,coach?.fightTrigger].map(clean).filter(Boolean).join(' '));
    if(/FARM|SCALE|SURVIVE|WAIT|PRESERVE|ABSORB/.test(text))return'FARM';
    if(/PRESS|TEMPO|FIRST MOVE|DENY|CONTROL/.test(text))return'PRESSURE';
    if(/FIGHT|ENGAGE|DIVE|PICK|ATTACK|PUNISH/.test(text))return'FIGHT';
    return'SET UP';
  }

  function applyCoach(coach,champion,userRole,ours,enemies){
    if(!coach)return;
    const threats=Array.isArray(coach?.threats)?coach.threats.map(clean).filter(Boolean).slice(0,3):[];
    const threatText=threats.join(' + ')||'THEIR ACCESS';
    const resolvedRole=normRole(coach?._resolvedRole)||normRole(userRole);
    const ourRoleMap=new Map((Array.isArray(coach?._resolvedOurRoles)?coach._resolvedOurRoles:[]).map(item=>[clean(item?.champion).toLowerCase(),normRole(item?.role)]));
    const enemyRoleMap=new Map((Array.isArray(coach?._resolvedEnemyRoles)?coach._resolvedEnemyRoles:[]).map(item=>[clean(item?.champion).toLowerCase(),normRole(item?.role)]));
    const resolvedOurs=ours.map(p=>{
      const serverRole=ourRoleMap.get(clean(p?.champion).toLowerCase());
      if(serverRole)return{...p,position:serverRole};
      return clean(p?.champion).toLowerCase()===clean(champion).toLowerCase()&&resolvedRole?{...p,position:resolvedRole}:p;
    });
    const resolvedEnemies=enemies.map(p=>{
      const serverRole=enemyRoleMap.get(clean(p?.champion).toLowerCase());
      return serverRole?{...p,position:serverRole}:p;
    });
    set('opRememberTitle',`${champion||'YOU'} · ${resolvedRole||'ROLE'} // WIN CONDITION`);
    const carryMap=coach?._playbook?.carryMap||coach?._carryMap||localCarryMap(champion,resolvedOurs,resolvedEnemies,threats[0]);
    renderCarryMap(carryMap);
    set('opRemGameCall',carryMap?.playerJob||coach?.headline||'WIN THE DRAFT');
    set('opRemGameCallWhy',carryMap?.reason||coach?.why||'PLAY THE FIGHT YOUR COMPOSITION WANTS');
    set('opRemDecisionCall',coachPriority(coach),'SET UP');
    set('opRemFightWhen',coach?.fightTrigger||coach?.threatAnswer||'YOUR SETUP IS READY');
    set('opRemStopRule',coach?.never||coach?.lanePlan?.respect||'DO NOT FORCE THE WRONG FIGHT');
    const threatLabel=document.querySelector('#opRememberHud .rem4-threat .rem4-label');
    if(threatLabel&&clean(coach?.threatLabel))threatLabel.textContent=upper(coach.threatLabel);
    set('opRemThreat',threatText);
    set('opRemThreatAnswer',coach?.threatAnswer||'TRACK THEIR ENTRY BEFORE COMMITTING');
    if(threats[0])document.body.style.setProperty('--op-threat-art',`url("${splash(threats[0])}")`);
    renderTeam('opRemOurTeam',resolvedOurs,'');
    renderTeam('opRemTheirTeam',resolvedEnemies,threats);
    renderCoachPath(coach?.steps);
    const laneOpponents=(Array.isArray(coach?.laneOpponents)?coach.laneOpponents:[]).map(clean).filter(Boolean).slice(0,2);
    const lane=clean(coach?.laneOpponent)||laneOpponents[0]||byRole(resolvedEnemies,resolvedRole);
    const lanePartner=clean(coach?.lanePartner);
    if((resolvedRole==='ADC'||resolvedRole==='SUPPORT')&&laneOpponents.length){
      set('opRemMatchTitle',`${champion||'YOU'}${lanePartner?' + '+lanePartner:''} VS ${laneOpponents.join(' + ')}`);
    }else if(lane)set('opRemMatchTitle',`${champion||'YOU'} VS ${lane}`);
    else set('opRemMatchTitle',resolvedRole?'MATCHUP DETECTING':'ROLE / MATCHUP DETECTING');
    const lanePlan=coach?.lanePlan||{};
    if(clean(lanePlan?.wave))set('opRemLaneDo',lanePlan.wave);
    if(clean(lanePlan?.trade))set('opRemTradeWhen',lanePlan.trade);
    if(clean(lanePlan?.respect))set('opRemNever',lanePlan.respect);
    else if(clean(coach?.never))set('opRemNever',coach.never);
    if(clean(coach?.ifBehind))set('opRemBehind',coach.ifBehind);
    const threatCard=document.querySelector('#opRememberHud .rem4-threat');
    if(threatCard&&clean(coach?.theirPlan))threatCard.setAttribute('title','THEIR PLAN: '+upper(coach.theirPlan));
    const pathCards=[...document.querySelectorAll('#opRememberHud .rem4-step strong')];
    if(pathCards[3]&&clean(coach?.fightTrigger))pathCards[3].setAttribute('title',upper(coach.fightTrigger));
    if(pathCards[4]&&clean(coach?.objectiveSetup))pathCards[4].setAttribute('title',upper(coach.objectiveSetup));
    renderPersonalTrap(coach?._personalTrap||null);
    renderDecisionPremortem(coach?._decisionPremortem||coach?._playbook?.decisionPremortem||null);
    renderScenarioPrime(coach?._scenarioPrime||null);
    renderDecisionTransfer(coach?._decisionTransferPrime||null);
    const climbMission=coach?._climbMission||null;
    const intentProbe=coach?._intentProbe||null;
    const coachingStrategy=coach?._coachingStrategy||null;
    const causalCoachRoute=coach?._causalCoachRoute||null;
    const experimentSchedule=coach?._experimentSchedule||null;
    const coachIntervention=coach?._coachIntervention||null;
    renderCoachingStrategy(coachingStrategy);
    renderCausalCoachRoute(causalCoachRoute);
    renderExperimentSchedule(experimentSchedule);
    renderIntentProbe(intentProbe,coach);
    const intentPending=Boolean(intentProbe?.version===1&&!intentProbe?.response?.selectedOptionId&&skippedIntentProbeId!==intentProbe.id);
    set('opRemMission',intentPending?'ANSWER THE INTENT CHECK ABOVE TO UNLOCK THIS COACHING CUE':(coachIntervention?.primaryCue||(climbMission?.status==='READY'?(climbMission.cue||climbMission.action):'NO FORCED REP THIS DRAFT · EXECUTE THE FROZEN GAME PLAN')));
    const missionNode=$('opRemMission');if(missionNode)missionNode.title=intentPending?'FREEZE YOUR OWN DECISION FIRST · THE COACHING CUE IS DELIBERATELY HIDDEN':coachIntervention
      ?[clean(coachIntervention.title),clean(coachIntervention.methodLabel),clean(coachIntervention.whyThisMethod),clean(coachIntervention.secondaryPrompt),clean(coachIntervention.boundary)].filter(Boolean).join(' · ')
      :climbMission?[clean(climbMission.title),clean(climbMission.whyThisGame),clean(climbMission.successDefinition),clean(climbMission.reviewRule)].filter(Boolean).join(' · '):'';
    renderDecisionSimulation(coach?._decisionSimulation||null);
    renderPlaybook(coach?._playbook||null,{source:coach?._coachSource||'local',quality:coach?._coachQuality||null});
    emitMatchContract(coach);
  }

  async function requestCoach(signature,champion,userRole,ours,enemies){
    const fallback=localCoach(champion,userRole,ours,enemies);
    applyCoach(fallback,champion,userRole,ours,enemies);
    if(lastCoachSignature===signature&&lastCoach){
      applyCoach(lastCoach,champion,userRole,ours,enemies);
      return;
    }
    const now=Date.now();
    if(lastCoachAttemptSignature===signature&&now-lastCoachAttemptAt<30000)return;
    if(coachInFlight||typeof window.opCompanion?.draftCoach!=='function'||ours.length<3||enemies.length<3)return;
    lastCoachAttemptSignature=signature;
    lastCoachAttemptAt=now;
    coachInFlight=true;
    renderCoachStatus({source:'loading',quality:null,failure:null});
    try{
      const response=await window.opCompanion.draftCoach({
        champion,
        role:userRole,
        gameMode:clean(lastRoster?.gameMode)||null,
        ours:ours.map(p=>({champion:p.champion,role:playerRole(p)||null,items:Array.isArray(p?.items)?p.items:[],summonerSpells:Array.isArray(p?.summonerSpells)?p.summonerSpells:[]})),
        enemies:enemies.map(p=>({champion:p.champion,role:playerRole(p)||null,items:Array.isArray(p?.items)?p.items:[],summonerSpells:Array.isArray(p?.summonerSpells)?p.summonerSpells:[]})),
      });
      if(response?.ok&&response?.ready&&response?.coach){
        const resolvedRole=normRole(response?.player?.role)||userRole;
        const enrichedCoach={...response.coach,_resolvedRole:resolvedRole};
        enrichedCoach._playbook=response?.playbook||null;
        enrichedCoach._playbookPolicy=response?.playbookPolicy||null;
        enrichedCoach._coachSource=clean(response?.source)||'rules';
        enrichedCoach._coachQuality=response?.coachQuality||null;
        enrichedCoach._playerCoachingIdentity=response?.playerCoachingIdentity||null;
        enrichedCoach._learningVelocity=response?.learningVelocity||null;
        enrichedCoach._skillTransferGraph=response?.skillTransferGraph||null;
        enrichedCoach._skillBridgePrime=response?.skillBridgePrime||null;
        enrichedCoach._decisionPrincipleEngine=response?.decisionPrincipleEngine||null;
        enrichedCoach._decisionPrinciplePrime=response?.decisionPrinciplePrime||null;
        enrichedCoach._adaptiveCoachingSession=response?.adaptiveCoachingSession||null;
        enrichedCoach._personalTrap=response?.personalTrap||null;
        enrichedCoach._decisionPremortem=response?.decisionPremortem||response?.playbook?.decisionPremortem||null;
        enrichedCoach._decisionSimulation=response?.decisionSimulation||null;
        enrichedCoach._scenarioPrime=response?.scenarioPrime||null;
        enrichedCoach._decisionTransferPrime=response?.decisionTransferPrime||null;
        enrichedCoach._climbMission=response?.climbMission||null;
        enrichedCoach._intentProbe=response?.intentProbe||null;
        enrichedCoach._coachingStrategy=response?.coachingStrategy||null;
        enrichedCoach._causalCoachRoute=response?.causalCoachRoute||null;
        enrichedCoach._experimentSchedule=response?.experimentSchedule||null;
        enrichedCoach._coachIntervention=response?.coachIntervention||null;
        enrichedCoach._matchContract=response?.matchContract||null;
        if(Array.isArray(response?.player?.laneOpponents)&&response.player.laneOpponents.length)enrichedCoach.laneOpponents=response.player.laneOpponents;
        if(clean(response?.player?.lanePartner))enrichedCoach.lanePartner=response.player.lanePartner;
        if(Array.isArray(response?.resolvedDraft?.ours))enrichedCoach._resolvedOurRoles=response.resolvedDraft.ours;
        if(Array.isArray(response?.resolvedDraft?.enemies))enrichedCoach._resolvedEnemyRoles=response.resolvedDraft.enemies;
        lastCoachSignature=signature;
        lastCoach=enrichedCoach;
        persistDeepLockedPlan(lastCoach,champion,resolvedRole);
        applyCoach(lastCoach,champion,resolvedRole,ours,enemies);
        return;
      }
      renderPersonalTrap(response?.personalTrap||null);
      renderDecisionPremortem(response?.decisionPremortem||null);
      renderPlaybook(null,{source:'local',quality:response?.coachQuality||null,failure:{
        code:clean(response?.code)||'REQUEST',
        status:Number(response?.status)||0,
        error:clean(response?.error)||'Deep coach unavailable. Using the safe local plan.',
        retryable:response?.retryable!==false,
      }});
    }catch(error){
      renderPlaybook(null,{source:'local',quality:null,failure:{code:'CLIENT',status:0,error:clean(error?.message)||'Deep coach unavailable. Using the safe local plan.',retryable:true}});
    }finally{coachInFlight=false}
  }

  function applyRoster(payload){
    lastRoster=payload;
    lastRosterSeenAt=Date.now();
    if(!lastState)return;
    const players=Array.isArray(payload?.players)?payload.players:[];
    if(players.length<2)return;
    const activeLive=players.find(p=>clean(p.summonerName)===clean(payload?.activePlayer))||null;
    const champion=clean(lastState?.matchup?.champion||lastState?.matchup?.plan?.you?.name||lastState?.teamPlan?.rememberPlan?.champion)||clean(activeLive?.champion);
    const me=players.find(p=>clean(p.champion).toLowerCase()===champion.toLowerCase())||activeLive;
    const hud=$('opRememberHud');
    if(hud)hud.classList.remove('hidden');
    document.body.classList.add('op-remember-live','op-live-roster-detected');
    const seconds=Math.max(0,Math.floor(Number(payload?.gameTime)||0));
    const clock=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    set('opRemLiveState',`LIVE · ${clock}`);
    if(!me?.team)return;
    const stateRole=normRole(lastState?.matchup?.role||lastState?.matchup?.plan?.role||lastState?.teamPlan?.rememberPlan?.role);
    const championPrior=STRONG_ADC_PRIOR.has(champion)?'ADC':'';
    const oursRaw=players.filter(p=>p.team===me.team);
    const enemiesRaw=players.filter(p=>p.team&&p.team!==me.team);
    const ours=repairTeam(oursRaw,'ourTeam',champion,playerRole(me)||stateRole||championPrior);
    const enemies=repairTeam(enemiesRaw,'theirTeam',champion,'');
    if(!enemies.length)return;
    const repairedMe=ours.find(p=>clean(p.champion).toLowerCase()===champion.toLowerCase())||ours.find(p=>clean(p.summonerName)===clean(payload?.activePlayer));
    const userRole=playerRole(repairedMe)||stateRole||championPrior;
    const rosterSignature=[
      champion,userRole,
      ...sorted(ours).map(p=>`O:${playerRole(p)}:${p.champion}`),
      ...sorted(enemies).map(p=>`E:${playerRole(p)}:${p.champion}`),
    ].join('|').toLowerCase();

    if(rosterSignature!==lastRosterSignature){
      lastRosterSignature=rosterSignature;
      renderTeam('opRemOurTeam',ours,'');
      renderTeam('opRemTheirTeam',enemies,'');
    }
    if(champion)document.body.style.setProperty('--op-live-splash',`url("${splash(champion)}")`);
    void requestCoach(rosterSignature,champion,userRole,ours,enemies);
    emitMatchContract(lastCoach);
  }

  function onState(state){
    const previousChampion=clean(lastState?.matchup?.champion||lastState?.matchup?.plan?.you?.name||lastState?.teamPlan?.rememberPlan?.champion);
    lastState=state;
    installVisualLayer();
    const champion=clean(state?.matchup?.champion||state?.matchup?.plan?.you?.name||state?.teamPlan?.rememberPlan?.champion);
    const rosterLive=Date.now()-lastRosterSeenAt<12_000;
    if((String(state?.phase||'')!=='RECORDING'&&!rosterLive)||(previousChampion&&champion&&previousChampion!==champion)){
      lastCoachSignature='';
      lastCoach=null;
      lastCoachAttemptSignature='';
      lastCoachAttemptAt=0;
      lastPlaybook=null;
      selectedBranch='EVEN';
      skippedIntentProbeId='';
      lastCoachMeta={source:'local',quality:null,failure:null};
      renderPersonalTrap(null);
      renderCoachingStrategy(null);
      renderCausalCoachRoute(null);
      renderExperimentSchedule(null);
      renderPlaybook(null,lastCoachMeta);
    }
    if(champion)document.body.style.setProperty('--op-live-splash',`url("${splash(champion)}")`);
    if(lastRoster)applyRoster(lastRoster);
    else emitMatchContract(lastCoach);
  }

  installVisualLayer();
  ensurePlaybookPanel();
  renderPersonalTrap(null);
  renderCoachingStrategy(null);
  renderCausalCoachRoute(null);
  renderExperimentSchedule(null);
  renderPlaybook(null,lastCoachMeta);
  window.addEventListener('op-climb-live-roster',event=>applyRoster(event.detail||{}));
  window.opCompanion?.getState?.().then(onState).catch(()=>{});
  window.opCompanion?.onState?.(onState);
})();
