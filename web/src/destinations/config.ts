import marsVideo from '../ui/cinematics/assets/spacetomars.mp4';
export type DestinationId='mars'|'neptune';
export interface DestinationConfig {id:DestinationId;displayName:string;texturePath:string;cinematicPath:string;arenaType:DestinationId;accent:string;description:string;}
export const DESTINATIONS:Record<DestinationId,DestinationConfig>={
 mars:{id:'mars',displayName:'Mars',texturePath:'/textures/planets/2k_mars.jpg',cinematicPath:marsVideo,arenaType:'mars',accent:'#ff9b55',description:'Jezero terrain · 3.7 m/s² reference gravity'},
 neptune:{id:'neptune',displayName:'Neptune',texturePath:'/textures/planets/2k_neptune.jpg',cinematicPath:'/assets/neptune/neptune-arrival.mp4',arenaType:'neptune',accent:'#66e9ff',description:'Fictional station above the clouds · no solid surface · 11.2 m/s² reference gravity'},
};
export function isDestination(value:unknown):value is DestinationId{return value==='mars'||value==='neptune';}
export const destinationFromWorld=(value:string):DestinationId=>isDestination(value)?value:'mars';
export async function preloadDestination(id:DestinationId){
 if(id==='neptune'){await import('../arena/neptune/NeptuneEnvironment');}
 else {const {preloadMarsTerrain}=await import('../arena/mars/MarsEnvironment');await preloadMarsTerrain();}
}
