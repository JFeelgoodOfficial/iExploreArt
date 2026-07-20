import * as THREE from 'three';

// Central material set. Created flat first; textures are attached by
// utils/assets.js once loaded so the gallery renders instantly and
// upgrades in place.

export function createMaterials(tier) {
  const glass = tier.glassTransmission
    ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transmission: 1, roughness: 0.035, metalness: 0,
        ior: 1.52, thickness: 0.03, transparent: true,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xdfe9ea, transparent: true, opacity: 0.14,
        roughness: 0.05, metalness: 0.4, envMapIntensity: 1.4, depthWrite: false,
      });

  return {
    plaster: new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.94 }),
    plasterWarm: new THREE.MeshStandardMaterial({ color: 0xeee4d4, roughness: 0.94 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa07a55, roughness: 0.62 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x4a3628, roughness: 0.55 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xb5afa4, roughness: 0.9 }),
    marble: new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.25, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.4, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa88b52, roughness: 0.35, metalness: 0.9 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x36626a, roughness: 1 }),
    glass,
    railGlass: new THREE.MeshStandardMaterial({
      color: 0xe8f0ef, transparent: true, opacity: 0.16, roughness: 0.08,
      metalness: 0.2, depthWrite: false, side: THREE.DoubleSide,
    }),
  };
}
