(function(){
'use strict';
const VERSION='pvp-social-touch-guard-v1.0.0';
function combatActive(){
  if(window.KELO_COMBAT_ENABLED===true)return true;
  try{
    const s=window.KeloPvPWorld&&window.KeloPvPWorld.state;
    return !!(s&&s.mode&&s.mode!=='social');
  }catch(e){return false;}
}
function closeSocialUi(){
  try{if(typeof window.closeSocialModal==='function')window.closeSocialModal();}catch(e){}
  try{if(typeof window.closeInspect==='function')window.closeInspect();}catch(e){}
  const ids=['inspect-sheet','kelo-self-actions','kelo-emotes-panel'];
  ids.forEach(function(id){const el=document.getElementById(id);if(el)el.style.display='none';});
  if(window.KELO_MODAL_INPUT_LOCK==='self-actions'||window.KELO_MODAL_INPUT_LOCK==='emotes'||window.KELO_MODAL_INPUT_LOCK==='profile-transition')window.KELO_MODAL_INPUT_LOCK=null;
}
function install(){
  const original=window.checkSocialTouch;
  if(typeof original!=='function'||original.__keloPvpSocialGuard)return false;
  function guarded(){
    if(combatActive()){
      closeSocialUi();
      return true;
    }
    return original.apply(this,arguments);
  }
  guarded.__keloPvpSocialGuard=true;
  guarded.__keloOriginal=original;
  window.checkSocialTouch=guarded;
  return true;
}
function boot(){
  install();
  // Some late UI modules may wrap checkSocialTouch after us. Reassert once after boot.
  setTimeout(install,0);
  setTimeout(install,250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.KeloPvPSocialTouchGuard=Object.freeze({version:VERSION,install,closeSocialUi,combatActive});
window.KELO_PVP_SOCIAL_TOUCH_AUDIT=Object.freeze({version:VERSION,blocksSocialProfilesInCombat:true,closesLegacyInspect:true,closesSelfActions:true});
})();
