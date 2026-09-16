/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / SHEET COMPOSER
 * owner: deterministic assembly of approved directional rows into the canonical Kelo atlas
 * purpose: compose 8 direction rows x 4 frames without asking the AI to lay out the final sheet
 * does-not-own: generation, QA approval, animation semantics
 */

export const DEFAULT_DIRECTION_ORDER=Object.freeze(['N','NE','E','SE','S','SW','W','NW']);

const toInt=(value,fallback=0)=>Number.isFinite(Number(value))?Math.floor(Number(value)):fallback;

export function composeDirectionalRows({rowsByDirection,directions=DEFAULT_DIRECTION_ORDER,frameWidth=64,frameHeight=64,framesPerDirection=4}={}){
  frameWidth=Math.max(1,toInt(frameWidth,64));
  frameHeight=Math.max(1,toInt(frameHeight,64));
  framesPerDirection=Math.max(1,toInt(framesPerDirection,4));
  const width=frameWidth*framesPerDirection,height=frameHeight*directions.length;
  const out=new Uint8ClampedArray(width*height*4);
  const missing=[];

  directions.forEach((direction,rowIndex)=>{
    const row=rowsByDirection?.[direction];
    const expected=width*frameHeight*4;
    if(!row?.data||row.data.length<expected){missing.push(direction);return;}
    const rowWidth=toInt(row.width,width),rowHeight=toInt(row.height,frameHeight);
    if(rowWidth!==width||rowHeight!==frameHeight)throw new Error(`SPRITE_COMPOSER_ROW_SIZE_MISMATCH:${direction}`);
    for(let y=0;y<frameHeight;y++){
      const sourceOffset=y*width*4,targetOffset=((rowIndex*frameHeight+y)*width)*4;
      out.set(row.data.subarray(sourceOffset,sourceOffset+width*4),targetOffset);
    }
  });

  return Object.freeze({
    pass:missing.length===0,
    data:out,
    width,
    height,
    columns:framesPerDirection,
    rows:directions.length,
    directions:Object.freeze([...directions]),
    missing:Object.freeze(missing)
  });
}

export function atlasCellIndex(direction,frame,{directions=DEFAULT_DIRECTION_ORDER,framesPerDirection=4}={}){
  const row=directions.indexOf(direction);
  const column=toInt(frame,-1);
  if(row<0||column<0||column>=framesPerDirection)return -1;
  return row*framesPerDirection+column;
}
