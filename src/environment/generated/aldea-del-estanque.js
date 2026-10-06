/* KELO-INDEX
 * area: WORLD / AUTHORED CONTENT
 * owner: KELO_WORLD_ZONES; presentation via KELO_PROP_CONTRACT
 * keys: MAP2 FANTASY TILESET VILLAGE POND COLLISION
 * purpose: aldea diseñada a mano con recortes reales del atlas fantasy, no una imagen de mapa
 * online: contenido estático con IDs estables; viajes por el owner de zonas y posición
 */
(function(){
'use strict';
const x=2420,y=180,T=64,w=1152,h=896;
const frames={
 grass:{x:17,y:15,w:68,h:72},flowers:{x:102,y:15,w:68,h:72},
 dirt:{x:440,y:16,w:68,h:70},stone:{x:778,y:16,w:68,h:70},water:{x:1118,y:16,w:68,h:70},lily:{x:1288,y:16,w:68,h:70},
 oak:{x:10,y:575,w:127,h:180},oak2:{x:145,y:574,w:124,h:180},pine:{x:277,y:575,w:109,h:180},
 autumn:{x:391,y:577,w:132,h:169},cherry:{x:531,y:577,w:126,h:146},
 shrub:{x:669,y:582,w:84,h:72},pinkBush:{x:762,y:584,w:76,h:64},whiteBush:{x:845,y:583,w:79,h:65},
 redHouse:{x:12,y:765,w:171,h:234},blueHouse:{x:191,y:763,w:159,h:236},inn:{x:356,y:775,w:178,h:224},
 stall:{x:812,y:787,w:99,h:116},cart:{x:815,y:909,w:168,h:91},well:{x:1110,y:782,w:104,h:127},
 barrel:{x:1130,y:715,w:49,h:65},crate:{x:1244,y:710,w:60,h:70},
 rock:{x:906,y:719,w:84,h:60},lamp:{x:1480,y:587,w:46,h:113},
 fence:{x:1016,y:588,w:103,h:57},hay:{x:1374,y:708,w:72,h:76}
};
const asset={id:'aldeaFantasy',src:'assets/world/tilesets/kelo-ai-fantasy-source.png?v=20261005a',width:1536,height:1024,frameMode:'irregular',frames};
const ground=[],props=[],colliders=[];
function placement(id,frame,px,py,pw,ph,group,solid){
 const bx=x+px,by=y+py,baseY=by+ph;
 const p={id:'aldea:'+id,family:'authored_fantasy',asset:'aldeaFantasy',frame,layerGroup:group,layerRole:'back',position:{x:bx,y:by},size:{w:pw,h:ph},anchor:{x:0,y:0},visualBounds:{x:bx,y:by,w:pw,h:ph},footprint:{x:bx,y:baseY-12,w:pw,h:12},collider:{mode:'none'},layers:{back:group==='aldeaGround'?'paths_floors':'props_back',front:group==='aldeaGround'?null:'props_front'},priority:92,district:'aldea',occlusion:group==='aldeaGround'?{mode:'none'}:{mode:'actor-base-y-clip-v1',baseY,clipPadding:8},visualOnly:!solid};
 (group==='aldeaGround'?ground:props).push(p);
 if(solid)colliders.push({id:p.id,x:bx+solid[0],y:by+solid[1],w:solid[2],h:solid[3],noDraw:true});
}
// Authored terrain plan: continuous southern route, central square, northern door approaches.
const paths=[[1,10,14,2],[7,3,2,9],[3,5,9,2],[3,4,1,2],[10,4,1,2]];
const plaza=[6,7,5,3],pond=[13,5,3,4];
const inside=(c,r,a)=>c>=a[0]&&r>=a[1]&&c<a[0]+a[2]&&r<a[1]+a[3];
for(let r=0;r<14;r++)for(let c=0;c<18;c++){
 let f='grass';
 if(paths.some(a=>inside(c,r,a)))f='dirt';
 if(inside(c,r,plaza)||inside(c,r,[12,4,5,6]))f='stone';
 if(inside(c,r,pond))f=(c===14&&r===6)?'lily':'water';
 placement(`ground-${c}-${r}`,f,c*T,r*T,T,T,'aldeaGround');
}
// Building doors open onto the northern lane; collisions cover walls, never their approaches.
placement('casa-roja','redHouse',155,128,154,211,'aldeaProps',[10,143,132,64]);
placement('casa-azul','blueHouse',351,92,143,212,'aldeaProps',[10,142,122,65]);
placement('posada','inn',571,128,171,215,'aldeaProps',[10,145,150,66]);
placement('pozo','well',503,412,91,105,'aldeaProps',[10,67,72,32]);
placement('mercado','stall',149,514,98,115,'aldeaProps',[8,70,82,40]);
placement('carreta','cart',262,555,128,69,'aldeaProps',[10,23,110,36]);
placement('barril','barrel',112,587,34,45,'aldeaProps',[3,22,28,20]);
placement('caja','crate',250,527,41,48,'aldeaProps',[2,24,38,22]);
placement('heno','hay',693,564,49,52,'aldeaProps',[5,26,38,22]);
// Deliberate asymmetric groves frame sight lines and leave a wide navigable circuit.
const trees=[['oak',18,16],['oak2',140,-6],['pine',283,2],['cherry',765,32],['oak',937,20],['pine',1043,80],['oak2',23,264],['cherry',42,438],['pine',1030,490],['oak',917,655],['oak2',1040,681],['oak2',727,686],['oak',391,694],['oak2',212,723],['pine',20,681]];
trees.forEach(([f,px,py],i)=>{const s=frames[f],pw=Math.round(s.w*.86),ph=Math.round(s.h*.86);placement(`arbol-${i}`,f,px,py,pw,ph,'aldeaProps',[pw*.42,ph-20,pw*.18,18]);});
[['pinkBush',321,355],['whiteBush',662,367],['shrub',782,248],['whiteBush',758,578],['pinkBush',605,704],['shrub',85,195],['pinkBush',906,153],['whiteBush',1060,316],['shrub',403,603]].forEach(([f,px,py],i)=>placement(`jardin-${i}`,f,px,py,56,46,'aldeaProps'));
[[357,451],[690,444],[147,670],[811,661]].forEach(([px,py],i)=>placement(`farol-${i}`,'lamp',px,py,36,84,'aldeaProps',[5,66,10,16]));
[[783,662],[851,663],[164,380],[735,374]].forEach(([px,py],i)=>placement(`roca-${i}`,'rock',px,py,44,31,'aldeaProps',[6,15,32,14]));
[[122,462],[227,462],[646,235]].forEach(([px,py],i)=>placement(`valla-${i}`,'fence',px,py,92,51,'aldeaProps',[4,29,84,16]));
colliders.push({id:'aldea:estanque',x:x+pond[0]*T,y:y+pond[1]*T,w:pond[2]*T,h:pond[3]*T,noDraw:true});
// Boundary is explicit collision geometry, not a movement clamp or a second physics loop.
[[0,-32,w,32],[-32,0,32,h],[w,0,32,h],[0,h,w,32]].forEach((b,i)=>colliders.push({id:`aldea:limite-${i}`,x:x+b[0],y:y+b[1],w:b[2],h:b[3],noDraw:true}));
props.sort((a,b)=>a.occlusion.baseY-b.occlusion.baseY);
window.KELO_ALDEA_MAP=Object.freeze({id:'aldea-del-estanque',name:'Aldea del Estanque',x,y,w,h,spawn:{x:x+544,y:y+658},portal:{x:x+96,y:y+736,r:42,label:'VOLVER'},asset,ground:Object.freeze(ground),props:Object.freeze(props),colliders:Object.freeze(colliders),revision:1});
})();
