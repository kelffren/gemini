/* KELO-INDEX
 * area: PVE / RUNTIME
 * owner: Kelo PvE
 * purpose: deterministic spawn + lightweight enemy state machine; no renderer, DOM, inventory or network writes
 */
import {createEnemy,rollAffixes,rollLoot} from './pve-foundation.mjs';

const F=Object.freeze;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rngFrom=seed=>{let x=hash(seed)||1;return()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296)};
const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));

export function createSpawnPlan({encounterId='encounter',count=4,center={x:0,y:0},radius=180,seed='world',family='beast',tier=1,partySize=1,eliteChance=.05,championChance=.01}={}){
  const rng=rngFrom(seed+':'+encounterId),rows=[];
  for(let i=0;i<count;i++){
    const angle=rng()*Math.PI*2,r=Math.sqrt(rng())*Math.max(16,radius),roll=rng();
    const rank=roll<championChance?'champion':roll<championChance+eliteChance?'elite':'normal';
    const base=createEnemy({id:family+'-'+i,family,hp:100,damage:10,telegraphMs:480,recoveryMs:360},{tier,partySize,rank});
    rows.push(F({...base,spawnId:encounterId+':'+i,x:Number((center.x+Math.cos(angle)*r).toFixed(2)),y:Number((center.y+Math.sin(angle)*r).toFixed(2)),affixes:rollAffixes({enemyId:encounterId+':'+i,slots:base.affixSlots,seed})}));
  }
  return F(rows);
}

export function createEnemyActor(spec={},options={}){
  const events=[],lootTable=options.lootTable||[],aggroRange=Math.max(32,Number(options.aggroRange)||260),attackRange=Math.max(16,Number(options.attackRange)||54),speed=Math.max(0,Number(options.speed)||70);
  const actor={id:String(spec.spawnId||spec.id||'enemy'),x:Number(spec.x)||0,y:Number(spec.y)||0,hp:Number(spec.hp)||100,maxHp:Number(spec.hp)||100,state:'idle',stateMs:0,target:null,dead:false};
  const emit=(type,payload={})=>{const row=F({type,enemyId:actor.id,...payload});events.push(row);globalThis.KeloEvents?.emit?.('kelo:pve:'+type,row)};
  function setState(next){if(actor.state===next)return;actor.state=next;actor.stateMs=0;emit('enemy-state',{state:next})}
  return F({
    get snapshot(){return F({...actor,events:F(events.slice(-20))})},
    update(dtMs,{target=null}={}){
      if(actor.dead)return this.snapshot;
      const dt=Math.max(0,Number(dtMs)||0);actor.stateMs+=dt;actor.target=target;
      const d=target?distance(actor,target):Infinity;
      if(!target||d>aggroRange){setState('idle');return this.snapshot}
      if(actor.state==='idle')setState(d<=attackRange?'telegraph':'chase');
      if(actor.state==='chase'){
        if(d<=attackRange)setState('telegraph');
        else {const step=Math.min(d,speed*dt/1000),dx=(target.x-actor.x)/d,dy=(target.y-actor.y)/d;actor.x+=dx*step;actor.y+=dy*step}
      }else if(actor.state==='telegraph'&&actor.stateMs>=Number(spec.telegraphMs||500)){
        setState('attack');emit('enemy-attack',{damage:Number(spec.damage)||0,targetId:target.id||null});
      }else if(actor.state==='attack'){setState('recovery')}
      else if(actor.state==='recovery'&&actor.stateMs>=Number(spec.recoveryMs||350))setState(d<=attackRange?'telegraph':'chase');
      return this.snapshot;
    },
    damage(amount,{sourceId=null,seed='world'}={}){
      if(actor.dead)return F({dead:true,drops:F([])});
      actor.hp=Math.max(0,actor.hp-Math.max(0,Number(amount)||0));emit('enemy-damaged',{amount:Number(amount)||0,hp:actor.hp,sourceId});
      if(actor.hp>0)return F({dead:false,hp:actor.hp,drops:F([])});
      actor.dead=true;setState('dead');
      const drops=rollLoot(lootTable,{seed:seed+':'+actor.id,multiplier:Number(spec.lootMultiplier)||1});
      emit('enemy-defeated',{sourceId,drops});
      return F({dead:true,hp:0,drops});
    }
  });
}

export function createEncounterRuntime(plan=[],options={}){
  const actors=new Map(plan.map(spec=>[spec.spawnId||spec.id,createEnemyActor(spec,options)]));
  return F({
    update(dtMs,context={}){for(const actor of actors.values())actor.update(dtMs,context);return this.snapshot()},
    damage(enemyId,amount,meta={}){const actor=actors.get(String(enemyId));if(!actor)throw new Error('PVE_ENEMY_UNKNOWN:'+enemyId);return actor.damage(amount,meta)},
    snapshot(){return F([...actors.values()].map(a=>a.snapshot))},
    get cleared(){return [...actors.values()].every(a=>a.snapshot.dead)}
  });
}
