import { createRoom } from './scene.js';

// Reuse the homepage model rather than a second, separately built auditorium.
export function createCinemaScene(container){
  const room=createRoom(container,()=>{},{projection:true});
  return {
    setPhoto:room.setProjectionPhoto,stop:room.stopProjection,
    preload:room.preloadProjection,setPhotos:room.setPhotos,setAlbumPages:room.setAlbumPages,
    fit:room.fit,setActive:room.setActive
  };
}
