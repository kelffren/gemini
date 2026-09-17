/* KELO-INDEX
 * area: QA / EVERGREEN / RUNTIME COMPATIBILITY
 * owner: Evergreen Runtime Compatibility CI
 * keys: AUDIT FEATURE DETECTION FALLBACK WEBKIT IOS NODE FUTURE PROVIDER ADAPTER
 * purpose: deterministically enforce Phase 3 runtime/browser/provider compatibility contracts
 * public-api: CLI only
 * state-owned: none; reads repository policy/configuration and executes pure compatibility probes
 * online: N/A; no external network calls
 * do-not: NO production mutation, NO browser-name feature gates, NO provider credentials
 */

import {readFile} from 'node:fs/promises';
import {detectRuntimeCapabilities,createRuntimeCompatibilityPlan,RUNTIME_CAPABILITY_SPECS} from '../src/core/evergreen-runtime-capabilities.mjs';
import {createProviderAdapterRegistry,EVERGREEN_PROVIDER_PORTS} from '../src/core/evergreen-provider-adapters.mjs';

const root=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');
const json=async path=>JSON.parse(await read(path));
const results=[];
const check=(condition,label)=>results.push({ok:Boolean(condition),label});

const policy=await json('config/evergreen-runtime-policy.json');
const pkg=await json('package.json');
const runtimeSource=await read('src/core/evergreen-runtime-capabilities.mjs');
const providerSource=await read('src/core/evergreen-provider-adapters.mjs');
const workflow=await read('.github/workflows/evergreen-runtime-compat.yml');
const browserStack=await read('browserstack.yml');

check(policy.schema===1,'runtime policy schema is v1');
check(policy.productionRuntime?.nodeMajor===24&&policy.productionRuntime?.blocking===true,'production runtime remains blocking Node 24 LTS');
check(policy.futureRuntime?.nodeMajor===26&&policy.futureRuntime?.blocking===false,'future Node 26 lane is advisory only');
check(pkg.engines?.node==='>=24.20.0 <25','package production engine remains bounded to Node 24');
check(policy.browserStrategy?.availabilityDecision==='feature-detection','browser availability decisions use feature detection');
check(policy.browserStrategy?.userAgentFeatureGatesAllowed===false,'user-agent feature gates are forbidden');
check(policy.browserStrategy?.progressiveEnhancementRequired===true,'progressive enhancement is mandatory');
check(policy.browserStrategy?.webkitGateRequired===true,'WebKit compatibility gate is mandatory');

const forbiddenBrowserGate=/navigator\s*\.\s*(?:userAgent|platform|appVersion|userAgentData)/;
check(!forbiddenBrowserGate.test(runtimeSource),'runtime capability owner contains no navigator browser/version sniffing');
check(!forbiddenBrowserGate.test(providerSource),'provider adapter owner contains no navigator browser/version sniffing');

const coreFromCode=RUNTIME_CAPABILITY_SPECS.filter(row=>row.tier==='core').map(row=>row.id).sort();
const coreFromPolicy=[...(policy.coreCapabilities||[])].sort();
check(JSON.stringify(coreFromCode)===JSON.stringify(coreFromPolicy),'core capability policy matches executable probes');
const onlineFromCode=RUNTIME_CAPABILITY_SPECS.filter(row=>row.tier==='online').map(row=>row.id).sort();
const onlineFromPolicy=[...(policy.onlineCapabilities||[])].sort();
check(JSON.stringify(onlineFromCode)===JSON.stringify(onlineFromPolicy),'online capability policy matches executable probes');
check(RUNTIME_CAPABILITY_SPECS.filter(row=>row.tier==='enhancement').every(row=>Boolean(row.fallback)),'every optional enhancement declares a fallback');

const fakeCoreEnv={
  Promise,
  URL,
  fetch:()=>Promise.resolve(),
  document:{createElement:()=>({getContext:name=>name==='2d'?{}:null})}
};
const coreSnapshot=detectRuntimeCapabilities(fakeCoreEnv);
const corePlan=createRuntimeCompatibilityPlan(coreSnapshot);
check(corePlan.compatible===true,'minimal core-capable environment remains supported');
check(corePlan.mode==='degraded-online','missing online transport degrades instead of crashing core');
check(corePlan.fallbacks.length>0,'missing optional APIs produce explicit fallback plan');

const brokenSnapshot=detectRuntimeCapabilities({});
const brokenPlan=createRuntimeCompatibilityPlan(brokenSnapshot);
check(brokenPlan.compatible===false&&brokenPlan.mode==='unsupported','missing core APIs is classified unsupported');

check(JSON.stringify(EVERGREEN_PROVIDER_PORTS)===JSON.stringify(policy.providerPorts),'provider port policy matches executable adapter contracts');
const providers=createProviderAdapterRegistry();
providers.register({
  id:'primary-test',kind:'storage',priority:10,isAvailable:()=>false,
  create:()=>({get(){},set(){},delete(){}})
});
providers.register({
  id:'fallback-test',kind:'storage',priority:20,isAvailable:()=>true,
  create:()=>({get(){return null;},set(){},delete(){}})
});
check(providers.resolve('storage')?.id==='fallback-test','provider registry selects available fallback by priority');
check(Boolean(providers.create('storage')),'provider registry validates and creates selected adapter');
let rejectedInvalidAdapter=false;
try{
  const invalid=createProviderAdapterRegistry();
  invalid.register({id:'bad',kind:'storage',create:()=>({get(){}})});
  invalid.create('storage');
}catch{rejectedInvalidAdapter=true;}
check(rejectedInvalidAdapter,'provider registry rejects adapters missing required port methods');

check(/npx playwright install --with-deps webkit/.test(workflow),'runtime CI installs WebKit explicitly');
check(/test:evergreen:webkit/.test(workflow),'runtime CI runs the dedicated WebKit/iOS-profile suite');
check(/node-version:\s*['"]?26['"]?/.test(workflow),'runtime CI contains a Node 26 future-runtime lane');
check(/continue-on-error:\s*true/.test(workflow),'future runtime lane cannot block production promotion');
check(/schedule:/.test(workflow),'future compatibility workflow runs on a schedule');
check(/browserName:\s*safari/i.test(browserStack)&&/deviceName:\s*iPhone/i.test(browserStack),'real-device profile remains Safari on iPhone');

const passed=results.filter(row=>row.ok).length;
const failed=results.filter(row=>!row.ok);
console.log(`EVERGREEN RUNTIME AUDIT · ${passed} pass · ${failed.length} fail`);
for(const row of results)console.log(`${row.ok?'PASS':'FAIL'} ${row.label}`);
if(failed.length)process.exitCode=1;
