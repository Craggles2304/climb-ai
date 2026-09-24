const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const theme=fs.readFileSync(path.join(root,'components','RouteVisualTheme.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'app','visual-depth.css'),'utf8');
const clientJs=fs.readFileSync(path.join(root,'public','client','app.js'),'utf8');
const clientCss=fs.readFileSync(path.join(root,'public','client','styles.css'),'utf8');
const landing=fs.readFileSync(path.join(root,'components','BroadcastLanding.module.css'),'utf8');

test('major League surfaces receive distinct route-aware visual identities',()=>{
  for(const area of ['hq','match','review','climb','coach','lab','plans','auth','system']){
    assert.ok(theme.includes("return'"+area+"'"),'missing route mapping '+area);
    assert.ok(css.includes('data-op-area="'+area+'"'),'missing theme '+area);
  }
});

test('client demo themes every major workspace view',()=>{
  assert.ok(clientJs.includes('document.body.dataset.clientView=route'));
  for(const view of ['match-room','climb','coach-memory','squad','plans']){
    assert.ok(clientCss.includes('data-client-view="'+view+'"'),'missing client theme '+view);
  }
});

test('landing scroll has section-level visual rhythm instead of one repeated background',()=>{
  assert.ok(landing.includes('counter-reset:op-section'));
  assert.ok(landing.includes('.section:nth-of-type(1)::after'));
  assert.ok(landing.includes('.section:nth-of-type(2)::after'));
  assert.ok(landing.includes('.section:nth-of-type(3)::after'));
});
