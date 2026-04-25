// Native direct URL imports (100% crash-proof on mobile browsers)
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// --- CONFIGURATION & TRUE SCALE DATA ---
const SCALE = 1 / 1000000; // 1 unit = 1,000,000 km

const celestialData = {
    Sun:     { r: 696340, d: 0,       period: 1,         color: 0xffdd00, type: 'star' },
    Mercury: { r: 2439,   d: 57.9e6,  period: 7603200,   color: 0x888888 },
    Venus:   { r: 6051,   d: 108.2e6, period: 19414080,  color: 0xe0b060 },
    Earth:   { r: 6371,   d: 149.6e6, period: 31553280,  color: 0x2b82c9, texture: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg' },
    Moon:    { r: 1737,   d: 384400,  period: 2358720,   color: 0xdddddd, parent: 'Earth' },
    Mars:    { r: 3389,   d: 227.9e6, period: 59356800,  color: 0xc1440e },
    Jupiter: { r: 69911,  d: 778.5e6, period: 374198400, color: 0xd39c7e },
    Saturn:  { r: 58232,  d: 1434e6,  period: 928540800, color: 0xc5ab6e }
};

// --- SCENE SETUP ---
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020205); // Deep space blue, prevents complete blackness
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.000001, 100000);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); 
scene.add(ambientLight);

// PointLight: Color, Intensity, Distance, Decay. Decay = 0 stops the light from fading over billions of miles.
const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); 
scene.add(sunLight);

// --- STARFIELD ---
function createStars() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const posArray = new Float32Array(starCount * 3);
    for(let i = 0; i < starCount; i++) {
        const r = 5000 + Math.random() * 5000;
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(Math.random() * 2 - 1);
        posArray[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        posArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.5, color: 0xffffff });
    scene.add(new THREE.Points(starGeo, starMat));
}
createStars();

// --- PLANET GENERATION & STATE ---
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'Anonymous'; // Prevents CORS black-screen errors
const bodies = {};
let simTime = 0;
let sunExists = true;

Object.keys(celestialData).forEach(name => {
    const data = celestialData[name];
    const radius = Math.max(data.r * SCALE, 0.0001); 
    
    let material;
    if (data.type === 'star') {
        material = new THREE.MeshBasicMaterial({ color: data.color });
        
        const spriteMat = new THREE.SpriteMaterial({
            map: createRadialGradient(),
            color: 0xffdd00,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Sprite(spriteMat);
        glow.scale.set(radius * 5, radius * 5, 1);
        data.glowMesh = glow;
        scene.add(glow);
    } else {
        if (data.texture) {
            material = new THREE.MeshStandardMaterial({ map: textureLoader.load(data.texture), roughness: 0.6 });
        } else {
            material = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.8 });
        }
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), material);
    scene.add(mesh);

    if (name === 'Earth') {
        const atmosMat = new THREE.MeshBasicMaterial({
            color: 0x4ba0ff,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending
        });
        const atmos = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 32, 32), atmosMat);
        mesh.add(atmos);
    }

    const trailGeo = new THREE.BufferGeometry();
    const maxTrail = 200;
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxTrail * 3), 3));
    const trailMat = new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.5 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);

    bodies[name] = {
        ...data,
        mesh,
        trail,
        trailPositions:[],
        phase: Math.random() * Math.PI * 2, 
        breakoutPos: new THREE.Vector3(),
        breakoutVel: new THREE.Vector3(),
        breakoutTime: 0
    };
});

function createRadialGradient() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 200, 0, 0.8)');
    grad.addColorStop(1, 'rgba(255, 150, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}

// --- PHYSICS SIMULATION ---
let lastTrailTime = 0;

function updatePhysics(dt) {
    simTime += dt;
    const recordTrail = (simTime - lastTrailTime) > 86400; // Save path point every 1 sim day
    if (recordTrail) lastTrailTime = simTime;

    Object.keys(bodies).forEach(name => {
        const body = bodies[name];
        if (name === 'Sun') return;

        let globalPos = new THREE.Vector3();
        
        if (sunExists || body.parent === 'Earth') {
            const angularVel = (2 * Math.PI) / body.period;
            const currentAngle = body.phase + (simTime * angularVel);
            const distInUnits = body.d * SCALE;
            const localX = Math.cos(currentAngle) * distInUnits;
            const localZ = Math.sin(currentAngle) * distInUnits;
            
            if (body.parent) {
                const parentPos = bodies[body.parent].mesh.position;
                globalPos.set(parentPos.x + localX, 0, parentPos.z + localZ);
            } else {
                globalPos.set(localX, 0, localZ);
            }
        } else {
            // SUN DISAPPEARED: Fly away in a straight line
            if (!body.parent) {
                const timeSinceBreakout = simTime - body.breakoutTime;
                globalPos.copy(body.breakoutPos).add(body.breakoutVel.clone().multiplyScalar(timeSinceBreakout));
            } else {
                const parentPos = bodies[body.parent].mesh.position;
                const angularVel = (2 * Math.PI) / body.period;
                const currentAngle = body.phase + (simTime * angularVel);
                const distInUnits = body.d * SCALE;
                globalPos.set(
                    parentPos.x + Math.cos(currentAngle) * distInUnits,
                    0,
                    parentPos.z + Math.sin(currentAngle) * distInUnits
                );
            }
        }

        body.mesh.position.copy(globalPos);

        if (recordTrail) { 
            body.trailPositions.push(globalPos.clone());
            if (body.trailPositions.length > 200) body.trailPositions.shift();
            
            const positions = body.trail.geometry.attributes.position.array;
            for(let i=0; i<body.trailPositions.length; i++) {
                positions[i*3] = body.trailPositions[i].x;
                positions[i*3+1] = body.trailPositions[i].y;
                positions[i*3+2] = body.trailPositions[i].z;
            }
            body.trail.geometry.attributes.position.needsUpdate = true;
            body.trail.geometry.setDrawRange(0, body.trailPositions.length);
        }
    });
}

// "What if Sun Disappeared" Logic
function triggerSunDisappearance() {
    sunExists = !sunExists;
    const sunMesh = bodies['Sun'].mesh;
    const sunGlow = celestialData['Sun'].glowMesh;
    
    if (!sunExists) {
        sunMesh.visible = false;
        sunGlow.visible = false;
        sunLight.intensity = 0;

        Object.keys(bodies).forEach(name => {
            const body = bodies[name];
            if (name === 'Sun' || body.parent) return;

            const angularVel = (2 * Math.PI) / body.period;
            const currentAngle = body.phase + (simTime * angularVel);
            const distInUnits = body.d * SCALE;
            
            const vx = -Math.sin(currentAngle) * distInUnits * angularVel;
            const vz = Math.cos(currentAngle) * distInUnits * angularVel;
            
            body.breakoutPos.copy(body.mesh.position);
            body.breakoutVel.set(vx, 0, vz);
            body.breakoutTime = simTime;
        });
    } else {
        sunMesh.visible = true;
        sunGlow.visible = true;
        sunLight.intensity = 3;
        
        Object.keys(bodies).forEach(name => {
            const body = bodies[name];
            if(name === 'Sun' || body.parent) return;
            const currentPos = body.mesh.position;
            const angle = Math.atan2(currentPos.z, currentPos.x);
            const angularVel = (2 * Math.PI) / body.period;
            body.phase = angle - (simTime * angularVel);
            
            body.trailPositions =[];
            body.trail.geometry.setDrawRange(0, 0);
        });
    }
}

// --- UI AND INTERACTIONS ---
let focusedPlanet = null;

const chipContainer = document.getElementById('planet-chips');['Sun', 'Earth', 'Moon', 'Mars', 'Jupiter', 'Saturn'].forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (name === 'Sun' ? ' active' : '');
    btn.innerText = name;
    btn.onclick = () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        focusOn(name);
    };
    chipContainer.appendChild(btn);
});

function focusOn(name) {
    focusedPlanet = bodies[name];
    let offset = focusedPlanet.r * SCALE * 8; 
    if(name === 'Sun') offset = focusedPlanet.r * SCALE * 15; // Pull back heavily to see whole sun glow
    if(name === 'Moon') offset = focusedPlanet.r * SCALE * 20; 

    // Find direction camera is facing
    const dir = new THREE.Vector3().subVectors(camera.position, focusedPlanet.mesh.position).normalize();
    if(dir.lengthSq() === 0) dir.set(0,0,1);
    
    // Set new camera position safely outside the object
    const targetCamPos = focusedPlanet.mesh.position.clone().add(dir.multiplyScalar(offset));
    camera.position.copy(targetCamPos);
    
    controls.minDistance = focusedPlanet.r * SCALE * 1.1;
}

// Initialize camera correctly
camera.position.set(0, 10, 20); // Default placeholder
focusOn('Sun');

const timeSlider = document.getElementById('time-slider');
document.getElementById('sun-toggle').addEventListener('click', function() {
    triggerSunDisappearance();
    
    const icon = document.getElementById('sun-icon');
    const badge = document.getElementById('sim-status');
    if(sunExists) {
        this.classList.remove('alert');
        icon.innerText = 'wb_sunny';
        badge.innerText = 'Nominal Gravity';
        badge.classList.remove('alert');
    } else {
        this.classList.add('alert');
        icon.innerText = 'brightness_3';
        badge.innerText = 'Gravity Disabled - Drift';
        badge.classList.add('alert');
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- MAIN LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);

    const realDt = clock.getDelta();
    const simDt = realDt * parseFloat(timeSlider.value);
    
    updatePhysics(simDt);

    if (focusedPlanet) {
        controls.target.copy(focusedPlanet.mesh.position);
        // Make camera chase planet if flying out of orbit
        if(!sunExists && focusedPlanet.name !== 'Sun') {
             const dtPos = focusedPlanet.breakoutVel.clone().multiplyScalar(simDt);
             camera.position.add(dtPos);
        }
    }

    bodies['Earth'].mesh.rotation.y += realDt * 0.5;
    bodies['Sun'].mesh.rotation.y += realDt * 0.1;

    controls.update();
    renderer.render(scene, camera);
}

animate();
