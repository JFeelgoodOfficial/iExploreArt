import { setActiveRoom } from './world/Collision.js';

// Switches the player between the gallery and the courtyard room. Both rooms
// share one Three.js scene, so a "room" is really a set of scene children whose
// visibility we toggle, plus the collision data + interaction targets that go
// live while the player is inside it.
//
// Gallery content is added to the scene by many builders (not one parent
// group), so each room is described by a flat list of the top-level objects
// that belong to it. Interaction targets are swapped explicitly rather than
// filtered by visibility, because a hidden group's child meshes still raycast.

export function createRoomManager(opts) {
  const {
    scene, player, interaction, lighting, crLights,
    galleryLayer, courtyardLayer,
    galleryTargets, courtyardTargets,
    gallerySpawn, courtyardSpawn,
    gallerySegments, galleryGround,
    courtyardSegments, courtyardGround,
    galleryBackground, courtyardBackground,
  } = opts;

  let current = 'gallery';

  function show(layer, visible) {
    for (const obj of layer) obj.visible = visible;
  }

  function enterCourtyard() {
    if (current === 'courtyard') return;
    current = 'courtyard';
    show(galleryLayer, false);
    show(courtyardLayer, true);
    // Enclosed daylit room under a glass roof — give it a sky, not the gallery's
    // null (black) clear that would otherwise show through the glazing.
    scene.background = courtyardBackground;
    setActiveRoom({ segments: courtyardSegments, ground: courtyardGround });
    interaction.setTargets(courtyardTargets);
    player.teleport(courtyardSpawn.x, courtyardSpawn.z, courtyardSpawn.yaw);
    crLights.bake();   // shadowMap.autoUpdate is off — re-bake for the new room
  }

  function enterGallery() {
    if (current === 'gallery') return;
    current = 'gallery';
    show(courtyardLayer, false);
    show(galleryLayer, true);
    scene.background = galleryBackground;
    setActiveRoom({ segments: gallerySegments, ground: galleryGround });
    interaction.setTargets(galleryTargets);
    player.teleport(gallerySpawn.x, gallerySpawn.z, gallerySpawn.yaw);
    lighting.bake();
  }

  return {
    enterCourtyard,
    enterGallery,
    get current() { return current; },
  };
}
