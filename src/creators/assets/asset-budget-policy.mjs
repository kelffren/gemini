/* KELO-INDEX
 * area: CREATORS / ASSET BUDGET
 * owner: Kelo Creator Asset Bridge
 * keys: ROUTE ZONE BUDGET BYTES RGBA FILE COUNT REGRESSION
 * purpose: evaluate explicit asset-group transfer/decode budgets without coupling budget policy to runtime loaders
 * public-api: evaluateAssetBudgetGroup(), evaluateAssetBudgetPolicy()
 * state-owned: none; pure build-time policy
 * online: N/A; creator/build-time capability
 * do-not: infer route membership from gameplay or mutate assets to satisfy a budget
 */

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const ratio=(value,limit)=>limit>0?value/limit:null;

export function evaluateAssetBudgetGroup(records=[],group={}){
  const selected=records.filter(record=>{
    const path=String(record.path||'');
    const prefixes=Array.isArray(group.prefixes)?group.prefixes:[];
    const exact=Array.isArray(group.paths)?group.paths:[];
    const excluded=Array.isArray(group.excludePrefixes)?group.excludePrefixes:[];
    const included=(!prefixes.length&&!exact.length)||exact.includes(path)||prefixes.some(prefix=>path.startsWith(prefix));
    return included&&!excluded.some(prefix=>path.startsWith(prefix));
  });
  const totals={
    fileCount:selected.length,
    storedBytes:selected.reduce((sum,record)=>sum+(finite(record.storedBytes)||0),0),
    decodedRgbaBytes:selected.reduce((sum,record)=>sum+(finite(record.decodedRgbaBytes)||0),0),
    largestAssetBytes:selected.reduce((max,record)=>Math.max(max,finite(record.storedBytes)||0),0)
  };
  const limits={
    maxFileCount:finite(group.maxFileCount),
    maxStoredBytes:finite(group.maxStoredBytes),
    maxDecodedRgbaBytes:finite(group.maxDecodedRgbaBytes),
    maxLargestAssetBytes:finite(group.maxLargestAssetBytes)
  };
  const violations=[];
  const checks=[
    ['fileCount','maxFileCount','file-count-budget'],
    ['storedBytes','maxStoredBytes','stored-bytes-budget'],
    ['decodedRgbaBytes','maxDecodedRgbaBytes','decoded-rgba-budget'],
    ['largestAssetBytes','maxLargestAssetBytes','largest-asset-budget']
  ];
  for(const[metric,limitKey,reason]of checks){const limit=limits[limitKey];if(limit!=null&&totals[metric]>limit)violations.push({reason,metric,value:totals[metric],limit,ratio:Number((totals[metric]/Math.max(1,limit)).toFixed(6))});}
  const utilization=Object.fromEntries(checks.map(([metric,limitKey])=>[metric,limits[limitKey]==null?null:Number((ratio(totals[metric],limits[limitKey])||0).toFixed(6))]));
  return{id:String(group.id||'asset-group'),description:group.description||null,pass:violations.length===0,totals,limits,utilization,violations,files:selected.map(record=>({path:record.path,storedBytes:record.storedBytes,decodedRgbaBytes:record.decodedRgbaBytes,width:record.width,height:record.height}))};
}

export function evaluateAssetBudgetPolicy(records=[],policy={}){
  const groups=(Array.isArray(policy.groups)?policy.groups:[]).map(group=>evaluateAssetBudgetGroup(records,group));
  return{version:'kelo-asset-budget-policy-v1',pass:groups.every(group=>group.pass),groupCount:groups.length,violations:groups.reduce((sum,group)=>sum+group.violations.length,0),groups};
}
