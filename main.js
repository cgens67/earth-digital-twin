import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';
import '@material/web/switch/switch.js';
import * as Cesium from 'cesium';

// 1. Initialize full Earth viewer 
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(), // Adds real mountains/elevation
  baseLayerPicker: false, 
  animation: false,
  timeline: false,
  shouldAnimate: true
});

// Activate daylight and shadows
viewer.scene.globe.enableLighting = true;
viewer.scene.highDynamicRange = true;
viewer.shadows = true;

let buildingTileset;

// 2. Add free global 3D City Buildings
async function initBuildings() {
   try {
     buildingTileset = await Cesium.createOsmBuildingsAsync();
     viewer.scene.primitives.add(buildingTileset);
   } catch (error) {
     console.error("Buildings error:", error);
   }
}
initBuildings();

// 3. Smooth Flight System Logic
function flyToCamera(lon, lat, height, pitchDeg = -25) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
    orientation: {
      heading: Cesium.Math.toRadians(45.0),
      pitch: Cesium.Math.toRadians(pitchDeg),
      roll: 0.0
    },
    duration: 2.5 // Smooth animation time
  });
}

// 4. Button Events
document.getElementById('btn-space').addEventListener('click', () => {
    // Zoom out to deep orbit
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(101.7118, 3.1583, 12000000.0), 
        duration: 2.5
    });
});

document.getElementById('btn-ny').addEventListener('click', () => {
    // Manhattan Street View
    flyToCamera(-74.0135, 40.7060, 600.0, -20.0);
});

document.getElementById('btn-kl').addEventListener('click', () => {
    // Kuala Lumpur Street View
    flyToCamera(101.7118, 3.1583, 750.0, -22.0);
});

// Toggle 3D buildings off/on
document.getElementById('toggle-buildings').addEventListener('change', (e) => {
  if (buildingTileset) {
    buildingTileset.show = e.target.selected;
  }
});
