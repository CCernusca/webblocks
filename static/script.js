const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pointColorPicker = document.getElementById('point-color');
const strokeColorPicker = document.getElementById('stroke-color');

let points3D = [];
let edges = [];
let pointColor = '#0000ff';
let strokeColor = '#00ff00';

// --- Camera / View ---
const view = {
    x: 0,
    y: 0,
    z: 0,
    fov: 90,
    // orientation basis vectors
    forward: [0, 0, 1],
    right: [1, 0, 0],
    up: [0, 1, 0]
};

// ------------------------------------------------
// Canvas setup
// ------------------------------------------------
function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size;
    canvas.height = size;
    if (points3D.length > 0) render();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ------------------------------------------------
// Fetch 3D data
// ------------------------------------------------
fetch('/api/points')
    .then(res => res.json())
    .then(data => { points3D = data.points; });

fetch('/api/edges')
    .then(res => res.json())
    .then(data => { edges = data.edges; render(); });

// ------------------------------------------------
// Rotation & vector helpers
// ------------------------------------------------
function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0]/len, v[1]/len, v[2]/len];
}

function cross(a,b) {
    return [
        a[1]*b[2]-a[2]*b[1],
        a[2]*b[0]-a[0]*b[2],
        a[0]*b[1]-a[1]*b[0]
    ];
}

function rotateAroundAxis(v, axis, angleDeg) {
    const rad = angleDeg*Math.PI/180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dot = v[0]*axis[0]+v[1]*axis[1]+v[2]*axis[2];
    const crossProd = cross(axis,v);
    return [
        v[0]*cos + crossProd[0]*sin + axis[0]*dot*(1-cos),
        v[1]*cos + crossProd[1]*sin + axis[1]*dot*(1-cos),
        v[2]*cos + crossProd[2]*sin + axis[2]*dot*(1-cos)
    ];
}

// ------------------------------------------------
// Project 3D -> 2D
// ------------------------------------------------
function projectCameraSpace(camPoint) {
    const eps = 1e-4;
    const z = camPoint[2] <= eps ? eps : camPoint[2];
    const fovRad = view.fov * Math.PI/180;
    const focal = (canvas.height/2)/Math.tan(fovRad/2);
    const xPixel = (camPoint[0]*focal)/z;
    const yPixel = (camPoint[1]*focal)/z;
    return { ndc: [xPixel/(canvas.width/2), yPixel/(canvas.height/2)], z };
}

function screen(pointNdc) {
    return [
        ((pointNdc[0]+1)/2)*canvas.width,
        (1-(pointNdc[1]+1)/2)*canvas.height
    ];
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ------------------------------------------------
// Rendering
// ------------------------------------------------
function render() {
    if (!points3D || points3D.length===0) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const cameraSpacePoints = points3D.map(pt => {
        const cx = pt[0]-view.x;
        const cy = pt[1]-view.y;
        const cz = pt[2]-view.z;
        return [
            cx*view.right[0] + cy*view.right[1] + cz*view.right[2],
            cx*view.up[0]    + cy*view.up[1]    + cz*view.up[2],
            cx*view.forward[0]+ cy*view.forward[1]+ cz*view.forward[2]
        ];
    });

    const projected = cameraSpacePoints.map(cp => projectCameraSpace(cp));
    const pixelPoints = projected.map(p => screen(p.ndc));

    const sortedIndices = projected
        .map((p,i)=>({z:p.z,i}))
        .sort((a,b)=>b.z-a.z)
        .map(x=>x.i);

    ctx.strokeStyle = hexToRgba(strokeColor,0.6);
    ctx.lineWidth = 2;
    edges.forEach(edge=>{
        const p1 = pixelPoints[edge[0]];
        const p2 = pixelPoints[edge[1]];
        if(!p1||!p2||!isFinite(p1[0])||!isFinite(p2[0])) return;
        ctx.beginPath();
        ctx.moveTo(p1[0],p1[1]);
        ctx.lineTo(p2[0],p2[1]);
        ctx.stroke();
    });

    ctx.fillStyle = pointColor;
    const size=8;
    for(const idx of sortedIndices){
        const p = pixelPoints[idx];
        if(!p||!isFinite(p[0])||!isFinite(p[1])) continue;
        ctx.beginPath();
        ctx.arc(p[0],p[1],size,0,Math.PI*2);
        ctx.fill();
    }
}

// ------------------------------------------------
// Color pickers
// ------------------------------------------------
pointColorPicker.addEventListener('input',e=>{
    pointColor = e.target.value; render();
});
strokeColorPicker.addEventListener('input',e=>{
    strokeColor = e.target.value; render();
});

// ------------------------------------------------
// Keyboard input
// ------------------------------------------------
const keys = {};
const BASE_MOVE_SPEED = 100;   // default movement speed
const BASE_ROTATE_SPEED = 90;  // default rotation speed in deg/sec

window.addEventListener('keydown',e=>keys[e.code]=true);
window.addEventListener('keyup',e=>keys[e.code]=false);

// Rotate camera around local axes
function updateCameraRotation(rotDelta){
    let rotated=false;

    // Yaw (A/D)
    if(keys['KeyA']){
        view.forward = rotateAroundAxis(view.forward, view.up, rotDelta);
        view.right   = rotateAroundAxis(view.right, view.up, rotDelta);
        rotated=true;
    }
    if(keys['KeyD']){
        view.forward = rotateAroundAxis(view.forward, view.up, -rotDelta);
        view.right   = rotateAroundAxis(view.right, view.up, -rotDelta);
        rotated=true;
    }

    // Pitch (W/S)
    if(keys['KeyW']){
        view.forward = rotateAroundAxis(view.forward, view.right, rotDelta);
        view.up      = rotateAroundAxis(view.up, view.right, rotDelta);
        rotated=true;
    }
    if(keys['KeyS']){
        view.forward = rotateAroundAxis(view.forward, view.right, -rotDelta);
        view.up      = rotateAroundAxis(view.up, view.right, -rotDelta);
        rotated=true;
    }

    // Roll (Q/E)
    if(keys['KeyE']){
        view.right = rotateAroundAxis(view.right, view.forward, -rotDelta);
        view.up    = rotateAroundAxis(view.up, view.forward, -rotDelta);
        rotated=true;
    }
    if(keys['KeyQ']){
        view.right = rotateAroundAxis(view.right, view.forward, rotDelta);
        view.up    = rotateAroundAxis(view.up, view.forward, rotDelta);
        rotated=true;
    }

    if(rotated){
        // Orthonormalize
        view.forward = normalize(view.forward);
        view.right   = normalize(cross(view.forward, view.up));
        view.up      = normalize(cross(view.right, view.forward));
    }

    return rotated;
}

// Update movement & rotation
let lastTime = performance.now();
function updateCamera(time){
    const deltaTime = (time - lastTime)/1000;
    lastTime = time;

    // Apply Left Ctrl modifier for both movement and rotation
    let speedMultiplier = keys['ControlLeft'] ? 10 : 1;

    const moveSpeed = BASE_MOVE_SPEED * speedMultiplier;
    const rotSpeed  = BASE_ROTATE_SPEED * speedMultiplier;

    const speed = moveSpeed * deltaTime;
    const rotDelta = rotSpeed * deltaTime;

    const {forward, right, up} = view;
    let moved=false;

    // --- Movement ---
    if(keys['ArrowUp'])   { view.x+=forward[0]*speed; view.y+=forward[1]*speed; view.z+=forward[2]*speed; moved=true; }
    if(keys['ArrowDown']) { view.x-=forward[0]*speed; view.y-=forward[1]*speed; view.z-=forward[2]*speed; moved=true; }
    if(keys['ArrowLeft']) { view.x-=right[0]*speed;   view.y-=right[1]*speed;   view.z-=right[2]*speed; moved=true; }
    if(keys['ArrowRight']){ view.x+=right[0]*speed;   view.y+=right[1]*speed;   view.z+=right[2]*speed; moved=true; }
    if(keys['Space'])     { view.x+=up[0]*speed;      view.y+=up[1]*speed;      view.z+=up[2]*speed; moved=true; }
    if(keys['ShiftLeft']) { view.x-=up[0]*speed;      view.y-=up[1]*speed;      view.z-=up[2]*speed; moved=true; }

    // --- Rotation ---
    const rotated = updateCameraRotation(rotDelta);

    if(moved || rotated) render();
    requestAnimationFrame(updateCamera);
}

// Start loop
requestAnimationFrame(updateCamera);

// ------------------------------------------------
// Expose utility functions
// ------------------------------------------------
function setViewPosition(x,y,z){ view.x=x; view.y=y; view.z=z; render(); }
function setFov(deg){ view.fov=deg; render(); }
window.setViewPosition=setViewPosition;
window.setFov=setFov;

render();
