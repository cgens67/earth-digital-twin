import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONFIGURATION & TRUE SCALE ---
// 1 Unit = 1,000,000 km. This prevents the browser math from overflowing.
const S = 1 / 1000000; 

const SystemData = {
    Sun:     { r: 696340, d: 0,       speed: 0,      color: 0xffdd00 },
    Mercury: { r: 2439,   d: 57.9e6,  speed: 0.04,   color: 0xaaaaaa },
    Venus:   { r: 6051,   d: 108.2e6, speed: 0.015,  color: 0xe0b060 },
    // Using a reliable WikiMedia commons Earth texture
    Earth:   { r: 6371,   d: 149.6e6, speed: 0.01,   color: 0x2b82c9, texture: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Land_ocean_ice_2048.jpg/1024px-Land_ocean_ice_2048.jpg' },
    Moon:    { r: 1737,   d: 384400,  speed: 0.13,   color: 0xcccccc, parent: 'Earth' },
    Mars:    { r: 3389,   d: 227.9e6, speed: 0.008,  color: 0xc1440e },
    Jupiter: { r: 69911,  d: 778.5e6, speed: 0.002,  color: 0xd39c7e },
    Saturn:  { r: 58232,  d: 1434e6,  speed: 0.0009, color: 0xc5ab6e }
};

// --- SCENE SETUP ---
const container = document.getElementById('webgl-container');

// logarithmicDepthBuffer is VITAL for true scale. It prevents the Earth from glitching out when zoomed out.
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508); // Very dark blue/black space

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.00001, 100000);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- LIGHTING ---
// Ambient light ensures we can see the dark sides of planets
const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
scene.add(ambientLight);

// The Sun's actual light. Decay is set to 0 so it reaches Saturn without dying out.
const sunLight = new THREE.PointLight(0xffffff, 2.5, 0, 0);
scene.add(sunLight);

// --- STARFIELD ---
const starsGeo = new THREE.BufferGeometry();
const starsCount = 4000;
const posArray = new Float32Array(starsCount * 3);

for(let i = 0; i < starsCount * 3; i += 3) {
    // Generate stars in a giant sphere around the system
    const radius = 6000 + Math.random() * 4000;
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos((Math.random() * 2) - 1);
    
    posArray[i] = radius * Math.sin(phi) * Math.cos(theta);
    posArray[i+1] = radius * Math.sin(phi) * Math.sin(theta);
    posArray[i+2] = radius * Math.cos(phi);
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starsMat = new THREE.PointsMaterial({ size: 1.2, color: 0xffffff, transparent: true, opacity: 0.8 });
scene.add(new THREE.Points(starsGeo, starsMat));

// --- PLANET GENERATOR ---
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous'; // Prevents CORS errors

const planets = {};
let sunIsActive = true;

Object.keys(SystemData).forEach(name => {
    const data = SystemData[name];
    
    // Safety check so ThreeJS doesn't crash on invisibly small objects
    const trueRadius = Math.max(data.r * S, 0.0005); 
    
    let material;
    if (name === 'Sun') {
        material = new THREE.MeshBasicMaterial({ color: data.color });
    } else {
        material = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.7 });
        
        // Load texture if it exists. If it fails, it just uses the safe base color.
        if (data.texture) {
            textureLoader.load(data.texture, (tex) => {
                material.map = tex;
                material.needsUpdate = true;
            });
        }
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(trueRadius, 64, 64), material);
    scene.add(mesh);

    // Orbit Path Line
    const pathMat = new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.3 });
    const pathGeo = new THREE.BufferGeometry();
    const pathPoints = new Float32Array(500 * 3);
    pathGeo.setAttribute('position', new THREE.BufferAttribute(pathPoints, 3));
    const pathLine = new THREE.Line(pathGeo, pathMat);
    scene.add(pathLine);

    planets[name] = {
        ...data,
        mesh,
        pathLine,
        pathPoints:[],
        angle: Math.random() * Math.PI * 2, // Random start position
        linearVelocity: new THREE.Vector3(), // For when gravity turns off
        linearPosition: new THREE.Vector3()
    };
});

// --- PHYSICS ENGINE ---
let globalTime = 0;
let uiSpeedMultiplier = 100;

function updatePhysics(delta) {
    // Delta time * UI Slider speed
    const simDelta = delta * uiSpeedMultiplier;
    globalTime += simDelta;

    Object.keys(planets).forEach(name => {
        if (name === 'Sun') return;
        const p = planets[name];

        let targetPos = new THREE.Vector3();

        if (sunIsActive || p.parent === 'Earth') {
            // NORMAL GRAVITY: Circular Orbital Math
            p.angle += p.speed * simDelta * 0.01;
            const distance = p.d * S;
            
            const localX = Math.cos(p.angle) * distance;
            const localZ = Math.sin(p.angle) * distance;

            if (p.parent) { // E.g., Moon orbiting Earth
                const parentPos = planets[p.parent].mesh.position;
                targetPos.set(parentPos.x + localX, 0, parentPos.z + localZ);
            } else { // Orbiting Sun
                targetPos.set(localX, 0, localZ);
            }

            p.mesh.position.copy(targetPos);
            p.linearPosition.copy(targetPos); // Keep linear starting point updated just in case

        } else {
            // NO GRAVITY: Linear Tangent Math (Straight Line into space)
            if (!p.parent) {
                const step = p.linearVelocity.clone().multiplyScalar(simDelta * 0.01);
                p.linearPosition.add(step);
                targetPos.copy(p.linearPosition);
                p.mesh.position.copy(targetPos);
            } else {
                // Moon still orbits Earth, but Earth is flying away
                p.angle += p.speed * simDelta * 0.01;
                const distance = p.d * S;
                const earthPos = planets['Earth'].mesh.position;
                targetPos.set(earthPos.x + Math.cos(p.angle)*distance, 0, earthPos.z + Math.sin(p.angle)*distance);
                p.mesh.position.copy(targetPos);
            }
        }

        // Update Trails (Leaves a line behind the planet)
        if (globalTime % 1 < simDelta) {
            p.pathPoints.push(targetPos.clone());
            if (p.pathPoints.length > 250) p.pathPoints.shift();
            
            const positions = p.pathLine.geometry.attributes.position.array;
            for(let i=0; i < p.pathPoints.length; i++) {
                positions[i*3] = p.pathPoints[i].x;
                positions[i*3+1] = p.pathPoints[i].y;
                positions[i*3+2] = p.pathPoints[i].z;
            }
            p.pathLine.geometry.attributes.position.needsUpdate = true;
            p.pathLine.geometry.setDrawRange(0, p.pathPoints.length);
        }
    });
}

// --- WHAT IF SUN DISAPPEARED LOGIC ---
const sunBtn = document.getElementById('sun-btn');
const sunIcon = document.getElementById('sun-icon');
const badge = document.getElementById('status-badge');

sunBtn.addEventListener('click', () => {
    sunIsActive = !sunIsActive;
    
    if (!sunIsActive) {
        // TURN OFF
        planets['Sun'].mesh.visible = false;
        sunLight.intensity = 0;
        ambientLight.intensity = 0.01; // Pitch black space
        
        sunBtn.classList.add('danger');
        sunIcon.innerText = 'brightness_3';
        badge.innerText = 'Gravity: Disabled (Drift)';
        badge.className = 'badge badge-danger';

        // Calculate Tangent Vectors (The exact direction they are flying when gravity stops)
        Object.keys(planets).forEach(name => {
            const p = planets[name];
            if (name === 'Sun' || p.parent) return;
            
            const dist = p.d * S;
            // Derivative of circle gives tangent velocity
            const velX = -Math.sin(p.angle) * dist * p.speed;
            const velZ = Math.cos(p.angle) * dist * p.speed;
            
            p.linearVelocity.set(velX, 0, velZ);
            p.linearPosition.copy(p.mesh.position);
        });

    } else {
        // TURN ON
        planets['Sun'].mesh.visible = true;
        sunLight.intensity = 2.5;
        ambientLight.intensity = 0.05;
        
        sunBtn.classList.remove('danger');
        sunIcon.innerText = 'light_mode';
        badge.innerText = 'Gravity: Normal';
        badge.className = 'badge badge-normal';

        // Erase straight lines, snap back to circular orbit angles based on current position
        Object.keys(planets).forEach(name => {
            const p = planets[name];
            p.pathPoints =[];
            p.pathLine.geometry.setDrawRange(0, 0);
            if(name === 'Sun' || p.parent) return;
            
            p.angle = Math.atan2(p.mesh.position.z, p.mesh.position.x);
        });
    }
});


// --- UI / CAMERA CONTROLS ---
let activeTarget = planets['Earth'];

const chipsContainer = document.getElementById('planet-chips');['Sun', 'Earth', 'Moon', 'Mars', 'Jupiter', 'Saturn'].forEach(name => {
    const btn = document.createElement('button');
    btn.className = `chip ${name === 'Earth' ? 'active' : ''}`;
    btn.innerText = name;
    
    btn.onclick = () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        focusPlanet(name);
    };
    chipsContainer.appendChild(btn);
});

function focusPlanet(name) {
    activeTarget = planets[name];
    
    // Dynamic zoom amount based on the true size of the planet
    let zoomMultiplier = 5; 
    if (name === 'Sun') zoomMultiplier = 3;
    if (name === 'Moon') zoomMultiplier = 15;
    
    const offsetDistance = Math.max(activeTarget.r * S * zoomMultiplier, 0.005);
    
    // Move camera smoothly outside the planet
    const direction = new THREE.Vector3().subVectors(camera.position, activeTarget.mesh.position).normalize();
    if (direction.length() === 0) direction.set(0, 0, 1);
    
    camera.position.copy(activeTarget.mesh.position).add(direction.multiplyScalar(offsetDistance));
    
    // Prevent zooming inside the planet
    controls.minDistance = activeTarget.r * S * 1.1;
    controls.maxDistance = 10000;
}

// Slider
document.getElementById('time-slider').addEventListener('input', (e) => {
    uiSpeedMultiplier = parseFloat(e.target.value);
});

// Resize window logic
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initial Camera setup
focusPlanet('Earth');

// --- RENDER LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    updatePhysics(delta);

    // Keep camera locked on target even if target is flying away
    if (activeTarget) {
        controls.target.copy(activeTarget.mesh.position);
        
        // If gravity is off, drag camera along the linear path automatically
        if (!sunIsActive && activeTarget.name !== 'Sun') {
            const step = activeTarget.linearVelocity.clone().multiplyScalar(delta * uiSpeedMultiplier * 0.01);
            camera.position.add(step);
        }
    }

    // Gentle spin
    planets['Earth'].mesh.rotation.y += delta * 0.2;
    planets['Sun'].mesh.rotation.y += delta * 0.05;

    controls.update();
    renderer.render(scene, camera);
}

animate();
