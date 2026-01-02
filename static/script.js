const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pointColorPicker = document.getElementById('point-color');
const strokeColorPicker = document.getElementById('stroke-color');

let points3D = [];
let edges = [];
let pointColor = '#0000ff';
let strokeColor = '#00ff00';

// Structure cache to avoid re-fetching
const structureCache = new Map();

// World structures map - stores structure types at world positions
// Format: "x,y,z" -> "structureName"
const worldStructureMap = new Map();

// Selected structure for placement (default: "cube")
let selectedStructure = "cube";

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
// World and structure loading
// ------------------------------------------------
function parseWorldPosition(key) {
    const parts = key.split(',').map(part => part.trim());
    if (parts.length !== 3) {
        console.warn(`Invalid world position format: "${key}". Expected "x,y,z" format.`);
        return null;
    }
    
    const coords = parts.map(part => {
        const num = parseInt(part, 10);
        if (isNaN(num)) {
            console.warn(`Invalid coordinate in world position "${key}": "${part}" is not a valid integer.`);
            return null;
        }
        return num;
    });
    
    if (coords.includes(null)) {
        return null;
    }
    
    return { x: coords[0], y: coords[1], z: coords[2] };
}

function loadWorld() {
    fetch('/api/world')
        .then(res => res.json())
        .then(worldData => {
            if (worldData.error) {
                console.error('Error loading world:', worldData.error);
                return;
            }
            
            // Clear existing data
            points3D = [];
            edges = [];
            
            const loadPromises = [];
            
            // Load each structure in the world
            for (const [worldPos, structureName] of Object.entries(worldData)) {
                if (!structureCache.has(structureName)) {
                    loadPromises.push(
                        fetch(`/api/structure/${structureName}`)
                            .then(res => res.json())
                            .then(structureData => {
                                if (structureData.error) {
                                    console.error(`Error loading structure "${structureName}":`, structureData.error);
                                    return;
                                }
                                structureCache.set(structureName, structureData);
                            })
                            .catch(err => console.error(`Failed to fetch structure "${structureName}":`, err))
                    );
                }
            }
            
            // After all structures are loaded, build the world
            Promise.all(loadPromises).then(() => {
                buildWorld(worldData);
                render();
            });
        })
        .catch(err => console.error('Failed to fetch world:', err));
}

function buildWorld(worldData) {
    // Clear previous world structures map
    worldStructureMap.clear();
    
    let pointOffset = 0;
    
    for (const [worldPosKey, structureName] of Object.entries(worldData)) {
        const structureData = structureCache.get(structureName);
        if (!structureData) continue;
        
        const worldPos = parseWorldPosition(worldPosKey);
        if (!worldPos) {
            console.warn(`Skipping structure "${structureName}" at invalid position "${worldPosKey}"`);
            continue;
        }
        
        // Store structure type at world position
        worldStructureMap.set(worldPosKey, structureName);
        
        // Add points with world position offset (multiplied by 100)
        for (const point of structureData.points) {
            points3D.push([
                point[0] + (worldPos.x * 100),
                point[1] + (worldPos.y * 100),
                point[2] + (worldPos.z * 100)
            ]);
        }
        
        // Add edges with point offset
        for (const edge of structureData.edges) {
            edges.push([
                edge[0] + pointOffset,
                edge[1] + pointOffset
            ]);
        }
        
        pointOffset += structureData.points.length;
    }
}

// Add a structure at a specific world position
function addStructure(worldPos, structureName) {
    const posKey = `${worldPos.x},${worldPos.y},${worldPos.z}`;
    
    // Check if position is already occupied
    if (worldStructureMap.has(posKey)) {
        console.warn(`Position ${posKey} is already occupied by ${worldStructureMap.get(posKey)}`);
        return false;
    }
    
    // Check if structure type exists
    const structureData = structureCache.get(structureName);
    if (!structureData) {
        console.error(`Structure type "${structureName}" not found in cache`);
        return false;
    }
    
    // Store structure in world map
    worldStructureMap.set(posKey, structureName);
    
    // Calculate point offset (current end of points array)
    const pointOffset = points3D.length;
    
    // Add points with world position offset
    for (const point of structureData.points) {
        points3D.push([
            point[0] + (worldPos.x * 100),
            point[1] + (worldPos.y * 100),
            point[2] + (worldPos.z * 100)
        ]);
    }
    
    // Add edges with point offset
    for (const edge of structureData.edges) {
        edges.push([
            edge[0] + pointOffset,
            edge[1] + pointOffset
        ]);
    }
    
    console.log(`Added ${structureName} at position ${posKey}`);
    return true;
}

// Remove a structure at a specific world position
function removeStructure(worldPos) {
    const posKey = `${worldPos.x},${worldPos.y},${worldPos.z}`;
    
    // Check if position has a structure
    const structureName = worldStructureMap.get(posKey);
    if (!structureName) {
        console.warn(`No structure found at position ${posKey}`);
        return false;
    }
    
    // Remove from world map
    worldStructureMap.delete(posKey);
    
    // Rebuild the entire world (simpler than trying to remove specific points/edges)
    // This ensures proper point offset handling
    rebuildWorld();
    
    console.log(`Removed ${structureName} from position ${posKey}`);
    return true;
}

// Rebuild the world from the worldStructureMap
function rebuildWorld() {
    // Clear points and edges
    points3D.length = 0;
    edges.length = 0;
    
    let pointOffset = 0;
    
    // Rebuild from world structure map
    for (const [posKey, structureName] of worldStructureMap) {
        const structureData = structureCache.get(structureName);
        if (!structureData) continue;
        
        const worldPos = parseWorldPosition(posKey);
        if (!worldPos) continue;
        
        // Add points with world position offset
        for (const point of structureData.points) {
            points3D.push([
                point[0] + (worldPos.x * 100),
                point[1] + (worldPos.y * 100),
                point[2] + (worldPos.z * 100)
            ]);
        }
        
        // Add edges with point offset
        for (const edge of structureData.edges) {
            edges.push([
                edge[0] + pointOffset,
                edge[1] + pointOffset
            ]);
        }
        
        pointOffset += structureData.points.length;
    }
}

// Load the world on start
loadWorld();

// ------------------------------------------------
// Position and rotation display
// ------------------------------------------------
const positionDisplay = document.getElementById('position-display');
const rotationCanvas = document.getElementById('rotation-canvas');
const rotationCtx = rotationCanvas.getContext('2d');
const pointsStatus = document.getElementById('points-status');
const edgesStatus = document.getElementById('edges-status');
const interactiveStatus = document.getElementById('interactive-status');

// Visibility state
let pointsVisible = true;
let edgesVisible = true;

// Interactive mode state
let interactiveMode = false;
let mouseX = 0;
let mouseY = 0;
let isPointerLocked = false;

function updatePositionDisplay() {
    const x = Math.round(view.x);
    const y = Math.round(view.y);
    const z = Math.round(view.z);
    positionDisplay.textContent = `${x}, ${y}, ${z}`;
}

function updateVisibilityDisplay() {
    // Update points status
    pointsStatus.textContent = pointsVisible ? 'ON' : 'OFF';
    pointsStatus.className = pointsVisible ? 'visibility-value on' : 'visibility-value off';
    
    // Update edges status
    edgesStatus.textContent = edgesVisible ? 'ON' : 'OFF';
    edgesStatus.className = edgesVisible ? 'visibility-value on' : 'visibility-value off';
}

function updateInteractiveDisplay() {
    const modeStatus = document.getElementById('mode-status');
    
    if (interactiveMode) {
        modeStatus.textContent = 'INTERACTIVE';
        modeStatus.className = 'mode-value interactive';
    } else if (altPressed) {
        modeStatus.textContent = 'ALIGNED';
        modeStatus.className = 'mode-value aligned';
    } else {
        modeStatus.textContent = 'NORMAL';
        modeStatus.className = 'mode-value normal';
    }
}

function togglePointsVisibility() {
    pointsVisible = !pointsVisible;
    updateVisibilityDisplay();
    render();
}

function toggleEdgesVisibility() {
    edgesVisible = !edgesVisible;
    updateVisibilityDisplay();
    render();
}

function toggleInteractiveMode() {
    interactiveMode = !interactiveMode;
    
    // Make modes mutually exclusive - disable Alt mode when entering interactive
    if (interactiveMode) {
        altPressed = false;
    }
    
    updateInteractiveDisplay();
    
    if (interactiveMode) {
        // Enable pointer lock for mouse control
        canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
        canvas.requestPointerLock();
        // Reset roll to 0 when entering interactive mode
        resetRoll();
    } else {
        // Exit pointer lock
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
        document.exitPointerLock();
    }
}

function resetRoll() {
    // Reset roll to 0 by orthonormalizing with world up
    const worldUp = [0, 1, 0];
    const dotProduct = view.forward[0] * worldUp[0] + view.forward[1] * worldUp[1] + view.forward[2] * worldUp[2];
    
    if (Math.abs(dotProduct) > 0.99) {
        // Forward is parallel to world up, use world forward as reference
        const worldForward = [0, 0, 1];
        view.right = cross(view.forward, worldForward);
    } else {
        view.right = cross(worldUp, view.forward);
    }
    
    view.up = cross(view.forward, view.right);
    
    // Normalize all vectors
    view.forward = normalize(view.forward);
    view.right = normalize(view.right);
    view.up = normalize(view.up);
}

function drawRotationArrow() {
    const width = rotationCanvas.width;
    const height = rotationCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas
    rotationCtx.clearRect(0, 0, width, height);
    
    // Draw 3D coordinate system
    draw3DCoordinateSystem(centerX, centerY);
    
    // Draw 3D arrow
    draw3DArrow(centerX, centerY);
}

function draw3DCoordinateSystem(centerX, centerY) {
    const axisLength = 25;
    
    // Draw axes with different colors
    // X axis (red) - pointing right
    draw3DLine(centerX, centerY, centerX + axisLength, centerY, '#ff6666', 1);
    
    // Y axis (green) - pointing up (in screen space, but represents world Y)
    draw3DLine(centerX, centerY, centerX, centerY - axisLength, '#66ff66', 1);
    
    // Z axis (blue) - pointing diagonally (representing depth)
    const zEndX = centerX - axisLength * 0.7;
    const zEndY = centerY + axisLength * 0.7;
    draw3DLine(centerX, centerY, zEndX, zEndY, '#6666ff', 1);
    
    // Draw axis labels
    rotationCtx.fillStyle = '#ff6666';
    rotationCtx.font = '10px Arial';
    rotationCtx.fillText('X', centerX + axisLength + 2, centerY + 3);
    
    rotationCtx.fillStyle = '#66ff66';
    rotationCtx.fillText('Y', centerX + 2, centerY - axisLength - 2);
    
    rotationCtx.fillStyle = '#6666ff';
    rotationCtx.fillText('Z', zEndX - 8, zEndY + 8);
}

function draw3DLine(x1, y1, x2, y2, color, width) {
    rotationCtx.strokeStyle = color;
    rotationCtx.lineWidth = width;
    rotationCtx.beginPath();
    rotationCtx.moveTo(x1, y1);
    rotationCtx.lineTo(x2, y2);
    rotationCtx.stroke();
}

function draw3DArrow(centerX, centerY) {
    // Get forward vector components
    const fx = view.forward[0];
    const fy = view.forward[1];
    const fz = view.forward[2];
    
    // Project 3D vector to 2D isometric-like view
    // Using a simple isometric projection
    const scale = 30;
    const screenX = centerX + (fx - fz) * scale * 0.7;
    const screenY = centerY - (fy + (fx + fz) * 0.35) * scale;
    
    // Draw arrow shaft
    draw3DLine(centerX, centerY, screenX, screenY, '#ff4444', 3);
    
    // Draw arrowhead
    const headLength = 8;
    const angle = Math.atan2(centerY - screenY, screenX - centerX);
    
    rotationCtx.fillStyle = '#ff4444';
    rotationCtx.beginPath();
    rotationCtx.moveTo(screenX, screenY);
    rotationCtx.lineTo(screenX - headLength * Math.cos(angle - Math.PI / 6), screenY + headLength * Math.sin(angle - Math.PI / 6));
    rotationCtx.lineTo(screenX - headLength * Math.cos(angle + Math.PI / 6), screenY + headLength * Math.sin(angle + Math.PI / 6));
    rotationCtx.closePath();
    rotationCtx.fill();
    
    // Draw center dot
    rotationCtx.fillStyle = '#333';
    rotationCtx.beginPath();
    rotationCtx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    rotationCtx.fill();
}

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

// Draw crosshair for interactive mode aiming
function drawCrosshair() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const size = 20;
    const thickness = 2;
    const color = '#ffffffff'; // White for visibility
    
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    
    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(centerX - size, centerY);
    ctx.lineTo(centerX + size, centerY);
    ctx.stroke();
    
    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX, centerY + size);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Optional: Draw corner brackets for better aiming reference
    const bracketSize = 10;
    const bracketGap = 5;
    
    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(centerX - size - bracketGap, centerY - size - bracketGap);
    ctx.lineTo(centerX - size - bracketGap, centerY - size - bracketGap + bracketSize);
    ctx.moveTo(centerX - size - bracketGap, centerY - size - bracketGap);
    ctx.lineTo(centerX - size - bracketGap + bracketSize, centerY - size - bracketGap);
    ctx.stroke();
    
    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(centerX + size + bracketGap, centerY - size - bracketGap);
    ctx.lineTo(centerX + size + bracketGap, centerY - size - bracketGap + bracketSize);
    ctx.moveTo(centerX + size + bracketGap, centerY - size - bracketGap);
    ctx.lineTo(centerX + size + bracketGap - bracketSize, centerY - size - bracketGap);
    ctx.stroke();
    
    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(centerX - size - bracketGap, centerY + size + bracketGap);
    ctx.lineTo(centerX - size - bracketGap, centerY + size + bracketGap - bracketSize);
    ctx.moveTo(centerX - size - bracketGap, centerY + size + bracketGap);
    ctx.lineTo(centerX - size - bracketGap + bracketSize, centerY + size + bracketGap);
    ctx.stroke();
    
    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(centerX + size + bracketGap, centerY + size + bracketGap);
    ctx.lineTo(centerX + size + bracketGap, centerY + size + bracketGap - bracketSize);
    ctx.moveTo(centerX + size + bracketGap, centerY + size + bracketGap);
    ctx.lineTo(centerX + size + bracketGap - bracketSize, centerY + size + bracketGap);
    ctx.stroke();
}

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
    
    // Only draw edges if visible
    if(edgesVisible) {
        edges.forEach(edge=>{
            const p1 = pixelPoints[edge[0]];
            const p2 = pixelPoints[edge[1]];
            if(!p1||!p2||!isFinite(p1[0])||!isFinite(p2[0])) return;
            ctx.beginPath();
            ctx.moveTo(p1[0],p1[1]);
            ctx.lineTo(p2[0],p2[1]);
            ctx.stroke();
        });
    }

    // Only draw points if visible
    if(pointsVisible) {
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
    
    // Draw crosshair in interactive mode
    if (interactiveMode) {
        drawCrosshair();
    }
    
    // Update position and rotation displays
    updatePositionDisplay();
    drawRotationArrow();
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

// Snapping variables
let altPressed = false;
let lastSnapTime = 0;
const SNAP_INTERVAL = 500; // 0.5 seconds in milliseconds
const GRID_SIZE = 100; // Position snap to whole hundreds
const ROTATION_SNAP = 90; // Rotation snap to 90 degrees

window.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(e.code === 'KeyV') {
        // Make modes mutually exclusive - disable interactive mode when V is pressed
        if (interactiveMode) {
            interactiveMode = false;
            document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
            document.exitPointerLock();
        }
        altPressed = true;
        snapToGrid();
        updateInteractiveDisplay();
    }
    
    // Handle visibility toggles
    if(e.code === 'KeyM') {
        togglePointsVisibility();
    }
    if(e.code === 'KeyN') {
        toggleEdgesVisibility();
    }
    
    // Handle interactive mode toggle
    if(e.code === 'KeyC') {
        toggleInteractiveMode();
    }
    
    // Handle ESC key to exit interactive mode
    if(e.code === 'Escape' && interactiveMode) {
        interactiveMode = false;
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
        document.exitPointerLock();
        updateInteractiveDisplay();
    }
    
    // Handle number keys for structure selection
    if(e.code.startsWith('Digit')) {
        handleStructureSelection(e.code);
    }
    
    // Prevent default browser behaviors for game controls
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'AltLeft', 'AltRight', 
        'KeyM', 'KeyN', 'KeyC', 'KeyV', 'Escape', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 
        'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code)) {
        e.preventDefault();
    }
});
window.addEventListener('keyup',e=>{
    keys[e.code]=false;
    if(e.code === 'KeyV') {
        altPressed = false;
        updateInteractiveDisplay();
    }
    // Prevent default browser behaviors for game controls
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'AltLeft', 'AltRight', 
        'KeyM', 'KeyN', 'KeyC', 'KeyV', 'Escape', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 
        'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code)) {
        e.preventDefault();
    }
});

// Initialize visibility and interactive displays
updateVisibilityDisplay();
updateInteractiveDisplay();

// Mouse event handlers for interactive mode
document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', (e) => {
    if (interactiveMode && isPointerLocked) {
        // Apply Alt speed multiplier to mouse sensitivity
        const speedMultiplier = keys['AltLeft'] || keys['AltRight'] ? 2 : 1;
        const sensitivity = 0.1 * speedMultiplier;
        const deltaYaw = e.movementX * sensitivity;
        const deltaPitch = e.movementY * sensitivity;
        
        // Apply yaw rotation using rotateAroundAxis (more reliable)
        const yawedForward = rotateAroundAxis(view.forward, [0, 1, 0], deltaYaw);
        const yawedRight = rotateAroundAxis(view.right, [0, 1, 0], deltaYaw);
        const yawedUp = rotateAroundAxis(view.up, [0, 1, 0], deltaYaw);
        
        // Apply pitch rotation using rotateAroundAxis (more reliable)
        const newForward = rotateAroundAxis(yawedForward, yawedRight, deltaPitch);
        const newUp = rotateAroundAxis(yawedUp, yawedRight, deltaPitch);
        
        view.forward = newForward;
        view.up = newUp;
        view.right = yawedRight; // Keep the yawed right vector
        
        // No resetRoll needed - yaw+pitch sequence should be clean
        render();
    }
});

// Mouse click handler for structure removal/addition in interactive mode
document.addEventListener('mousedown', (e) => {
    if (interactiveMode && isPointerLocked) {
        if (e.button === 0) { // Left mouse button - remove structure
            performRaycast();
        } else if (e.button === 2) { // Right mouse button - place structure
            performRaycastPlace();
        }
    }
});

// Perform raycast and remove first intersected structure
function performRaycast() {
    const rayOrigin = [view.x, view.y, view.z];
    const rayDirection = normalize(view.forward);
    
    let closestStructure = null;
    let closestDistance = Infinity;
    
    // Check each structure in the world
    for (const [posKey, structureName] of worldStructureMap) {
        const worldPos = parseWorldPosition(posKey);
        if (!worldPos) continue;
        
        const structureData = structureCache.get(structureName);
        if (!structureData) continue;
        
        // Transform structure points to world space
        const worldPoints = structureData.points.map(point => [
            point[0] + (worldPos.x * 100),
            point[1] + (worldPos.y * 100),
            point[2] + (worldPos.z * 100)
        ]);
        
        // Check ray-structure intersection (simplified bounding box check)
        const intersection = rayIntersectStructure(rayOrigin, rayDirection, worldPoints, worldPos);
        if (intersection && intersection.distance < closestDistance) {
            closestDistance = intersection.distance;
            closestStructure = worldPos;
        }
    }
    
    // Remove the closest structure if found
    if (closestStructure) {
        removeStructure(closestStructure);
        render();
        console.log(`Removed structure at ${closestStructure.x},${closestStructure.y},${closestStructure.z}`);
    }
}

// Perform raycast and place structure on hit surface
function performRaycastPlace() {
    const rayOrigin = [view.x, view.y, view.z];
    const rayDirection = normalize(view.forward);
    
    let closestStructure = null;
    let closestDistance = Infinity;
    let closestIntersection = null;
    
    // Check each structure in the world
    for (const [posKey, structureName] of worldStructureMap) {
        const worldPos = parseWorldPosition(posKey);
        if (!worldPos) continue;
        
        const structureData = structureCache.get(structureName);
        if (!structureData) continue;
        
        // Transform structure points to world space
        const worldPoints = structureData.points.map(point => [
            point[0] + (worldPos.x * 100),
            point[1] + (worldPos.y * 100),
            point[2] + (worldPos.z * 100)
        ]);
        
        // Check ray-structure intersection with surface detection
        const intersection = rayIntersectStructureWithSurface(rayOrigin, rayDirection, worldPoints, worldPos);
        if (intersection && intersection.distance < closestDistance) {
            closestDistance = intersection.distance;
            closestStructure = worldPos;
            closestIntersection = intersection;
        }
    }
    
    // Place structure at calculated position if surface was hit
    if (closestStructure && closestIntersection) {
        const placePosition = calculatePlacePosition(closestIntersection);
        if (placePosition) {
            const success = addStructure(placePosition, selectedStructure);
            if (success) {
                render();
                console.log(`Placed ${selectedStructure} at ${placePosition.x},${placePosition.y},${placePosition.z}`);
            }
        }
    }
}

// Ray-structure intersection with surface normal detection
function rayIntersectStructureWithSurface(rayOrigin, rayDirection, worldPoints, worldPos) {
    // First get basic AABB intersection
    const basicIntersection = rayIntersectStructure(rayOrigin, rayDirection, worldPoints, worldPos);
    if (!basicIntersection) return null;
    
    // Determine which face was hit by checking which axis is closest to the surface
    const hitPoint = basicIntersection.point;
    const structureCenter = [
        worldPos.x * 100,
        worldPos.y * 100,
        worldPos.z * 100
    ];
    
    // Calculate distances to each face center
    const halfSize = 50; // Assuming structures are 100x100x100
    
    const faces = [
        { normal: [1, 0, 0], center: [structureCenter[0] + halfSize, structureCenter[1], structureCenter[2]], direction: 'right' },
        { normal: [-1, 0, 0], center: [structureCenter[0] - halfSize, structureCenter[1], structureCenter[2]], direction: 'left' },
        { normal: [0, 1, 0], center: [structureCenter[0], structureCenter[1] + halfSize, structureCenter[2]], direction: 'up' },
        { normal: [0, -1, 0], center: [structureCenter[0], structureCenter[1] - halfSize, structureCenter[2]], direction: 'down' },
        { normal: [0, 0, 1], center: [structureCenter[0], structureCenter[1], structureCenter[2] + halfSize], direction: 'forward' },
        { normal: [0, 0, -1], center: [structureCenter[0], structureCenter[1], structureCenter[2] - halfSize], direction: 'backward' }
    ];
    
    let closestFace = null;
    let minDistance = Infinity;
    
    for (const face of faces) {
        const distance = Math.sqrt(
            Math.pow(hitPoint[0] - face.center[0], 2) +
            Math.pow(hitPoint[1] - face.center[1], 2) +
            Math.pow(hitPoint[2] - face.center[2], 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestFace = face;
        }
    }
    
    return {
        ...basicIntersection,
        hitNormal: closestFace.normal,
        hitDirection: closestFace.direction
    };
}

// Calculate position to place new structure
function calculatePlacePosition(intersection) {
    const hitDirection = intersection.hitDirection;
    const hitPoint = intersection.point;
    
    // Calculate grid position - for positive directions, don't add extra unit
    let gridX = Math.round(hitPoint[0] / 100);
    let gridY = Math.round(hitPoint[1] / 100);
    let gridZ = Math.round(hitPoint[2] / 100);
    
    // Adjust based on hit direction
    switch (hitDirection) {
        case 'right':
            // Don't add extra unit since we're already on the surface
            break;
        case 'left':
            gridX -= 1;
            break;
        case 'up':
            // Don't add extra unit since we're already on the surface
            break;
        case 'down':
            gridY -= 1;
            break;
        case 'forward':
            // Don't add extra unit since we're already on the surface
            break;
        case 'backward':
            gridZ -= 1;
            break;
    }
    
    const placePosition = { x: gridX, y: gridY, z: gridZ };
    
    // Check if position is already occupied
    const posKey = `${gridX},${gridY},${gridZ}`;
    if (worldStructureMap.has(posKey)) {
        console.log(`Position ${posKey} is already occupied`);
        return null;
    }
    
    return placePosition;
}

// Simple ray-structure intersection using bounding box
function rayIntersectStructure(rayOrigin, rayDirection, worldPoints, worldPos) {
    // Calculate bounding box
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    
    for (const point of worldPoints) {
        for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], point[i]);
            max[i] = Math.max(max[i], point[i]);
        }
    }
    
    // Ray-AABB intersection
    const tMin = [
        (min[0] - rayOrigin[0]) / rayDirection[0],
        (min[1] - rayOrigin[1]) / rayDirection[1],
        (min[2] - rayOrigin[2]) / rayDirection[2]
    ];
    
    const tMax = [
        (max[0] - rayOrigin[0]) / rayDirection[0],
        (max[1] - rayOrigin[1]) / rayDirection[1],
        (max[2] - rayOrigin[2]) / rayDirection[2]
    ];
    
    const t1 = [Math.min(tMin[0], tMax[0]), Math.min(tMin[1], tMax[1]), Math.min(tMin[2], tMax[2])];
    const t2 = [Math.max(tMin[0], tMax[0]), Math.max(tMin[1], tMax[1]), Math.max(tMin[2], tMax[2])];
    
    const tNear = Math.max(t1[0], t1[1], t1[2]);
    const tFar = Math.min(t2[0], t2[1], t2[2]);
    
    if (tNear > tFar || tFar < 0) {
        return null; // No intersection
    }
    
    return {
        distance: tNear > 0 ? tNear : tFar,
        point: [
            rayOrigin[0] + rayDirection[0] * (tNear > 0 ? tNear : tFar),
            rayOrigin[1] + rayDirection[1] * (tNear > 0 ? tNear : tFar),
            rayOrigin[2] + rayDirection[2] * (tNear > 0 ? tNear : tFar)
        ]
    };
}

// Handle structure selection using number keys
function handleStructureSelection(keyCode) {
    // Get sorted list of structure names from cache
    const structureNames = Array.from(structureCache.keys()).sort();
    
    // Extract number from key code
    let number = parseInt(keyCode.replace('Digit', ''));
    
    // Handle 0 as index 10
    if (number === 0) {
        number = 10;
    }
    
    // Check if number is within valid range (1-10)
    if (number < 1 || number > structureNames.length) {
        console.log(`Invalid structure index: ${number}. Available structures: 1-${structureNames.length}`);
        return;
    }
    
    // Select structure (1-based index)
    const selectedIndex = number - 1;
    selectedStructure = structureNames[selectedIndex];
    
    console.log(`Selected structure: ${selectedStructure} (index ${number})`);
}

// Check if position would collide with any structure
function checkCollision(position) {
    const playerRadius = 20; // Player collision radius in world units
    
    for (const [posKey, structureName] of worldStructureMap) {
        const worldPos = parseWorldPosition(posKey);
        if (!worldPos) continue;
        
        const structureData = structureCache.get(structureName);
        if (!structureData) continue;
        
        // Transform structure points to world space
        const worldPoints = structureData.points.map(point => [
            point[0] + (worldPos.x * 100),
            point[1] + (worldPos.y * 100),
            point[2] + (worldPos.z * 100)
        ]);
        
        // Calculate structure bounding box
        let min = [Infinity, Infinity, Infinity];
        let max = [-Infinity, -Infinity, -Infinity];
        
        for (const point of worldPoints) {
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], point[i]);
                max[i] = Math.max(max[i], point[i]);
            }
        }
        
        // Expand bounding box by player radius
        min[0] -= playerRadius; max[0] += playerRadius;
        min[1] -= playerRadius; max[1] += playerRadius;
        min[2] -= playerRadius; max[2] += playerRadius;
        
        // Check if player position is inside expanded bounding box
        if (position[0] >= min[0] && position[0] <= max[0] &&
            position[1] >= min[1] && position[1] <= max[1] &&
            position[2] >= min[2] && position[2] <= max[2]) {
            return true; // Collision detected
        }
    }
    
    return false; // No collision
}

// Function to snap position and rotation to grid
function snapToGrid() {
    // Snap position to nearest 100
    view.x = Math.round(view.x / GRID_SIZE) * GRID_SIZE;
    view.y = Math.round(view.y / GRID_SIZE) * GRID_SIZE;
    view.z = Math.round(view.z / GRID_SIZE) * GRID_SIZE;
    
    // For rotation, we need to extract current angles and snap them
    // This is complex with the current basis vector system,
    // so we'll implement a simpler approach for now
    snapRotationToGrid();
    render();
}

// Function to snap rotation to 90-degree multiples
function snapRotationToGrid() {
    // Extract current Euler angles from basis vectors
    const yaw = Math.atan2(view.forward[0], view.forward[2]) * 180 / Math.PI;
    const pitch = Math.asin(-view.forward[1]) * 180 / Math.PI;
    
    // Calculate roll from right vector
    const roll = Math.atan2(view.right[1], view.up[1]) * 180 / Math.PI;
    
    // Snap each angle to nearest 90 degrees
    const snappedYaw = Math.round(yaw / ROTATION_SNAP) * ROTATION_SNAP;
    const snappedPitch = Math.round(pitch / ROTATION_SNAP) * ROTATION_SNAP;
    const snappedRoll = Math.round(roll / ROTATION_SNAP) * ROTATION_SNAP;
    
    // Reconstruct basis vectors from snapped Euler angles
    const yawRad = snappedYaw * Math.PI / 180;
    const pitchRad = snappedPitch * Math.PI / 180;
    const rollRad = snappedRoll * Math.PI / 180;
    
    // Create rotation matrices and apply them
    // Forward vector (from yaw and pitch)
    view.forward = [
        Math.sin(yawRad) * Math.cos(pitchRad),
        -Math.sin(pitchRad),
        Math.cos(yawRad) * Math.cos(pitchRad)
    ];
    
    // Calculate right and up vectors including roll
    // Start with base right vector (no roll)
    let baseRight = [Math.cos(yawRad), 0, -Math.sin(yawRad)];
    let baseUp = [0, 1, 0];
    
    // Apply roll to right and up vectors around forward axis
    if (Math.abs(snappedRoll) > 0.1) {
        // Roll around forward axis
        const cosRoll = Math.cos(rollRad);
        const sinRoll = Math.sin(rollRad);
        
        // Rotate baseRight around forward
        const newRight = [
            baseRight[0] * cosRoll + baseUp[0] * sinRoll,
            baseRight[1] * cosRoll + baseUp[1] * sinRoll,
            baseRight[2] * cosRoll + baseUp[2] * sinRoll
        ];
        
        // Rotate baseUp around forward (perpendicular)
        const newUp = [
            -baseRight[0] * sinRoll + baseUp[0] * cosRoll,
            -baseRight[1] * sinRoll + baseUp[1] * cosRoll,
            -baseRight[2] * sinRoll + baseUp[2] * cosRoll
        ];
        
        view.right = newRight;
        view.up = newUp;
    } else {
        view.right = baseRight;
        view.up = baseUp;
    }
    
    // Normalize all vectors
    view.forward = normalize(view.forward);
    view.right = normalize(view.right);
    view.up = normalize(view.up);
}

// Rotate camera around local axes
function updateCameraRotation(rotDelta){
    let rotated=false;

    // If Alt is pressed, use grid-based rotation
    if(altPressed) {
        const currentTime = performance.now();
        if(currentTime - lastSnapTime >= SNAP_INTERVAL) {
            // Yaw (A/D)
            if(keys['KeyA']){
                rotateByGrid(0, -ROTATION_SNAP, 0);
                rotated=true;
            }
            if(keys['KeyD']){
                rotateByGrid(0, ROTATION_SNAP, 0);
                rotated=true;
            }

            // Pitch (W/S)
            if(keys['KeyW']){
                rotateByGrid(-ROTATION_SNAP, 0, 0);
                rotated=true;
            }
            if(keys['KeyS']){
                rotateByGrid(ROTATION_SNAP, 0, 0);
                rotated=true;
            }

            // Roll (Q/E)
            if(keys['KeyE']){
                rotateByGrid(0, 0, -ROTATION_SNAP);
                rotated=true;
            }
            if(keys['KeyQ']){
                rotateByGrid(0, 0, ROTATION_SNAP);
                rotated=true;
            }
            
            if(rotated) {
                lastSnapTime = currentTime;
            }
        }
    } else {
        // Normal rotation
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
    }

    if(rotated && !altPressed){
        // Orthonormalize only for normal rotation
        view.forward = normalize(view.forward);
        view.right   = normalize(cross(view.forward, view.up));
        view.up      = normalize(cross(view.right, view.forward));
    }

    return rotated;
}

// Function to rotate by grid increments
function rotateByGrid(pitch, yaw, roll) {
    // For exact 90° steps, we need to directly rotate the basis vectors
    // by 90° around world axes, not use smooth rotation
    
    if(pitch !== 0) {
        // Pitch 90° around world X axis
        const pitchRad = pitch * Math.PI / 180;
        const cosPitch = Math.cos(pitchRad);
        const sinPitch = Math.sin(pitchRad);
        
        const newForward = [
            view.forward[0],
            view.forward[1] * cosPitch - view.forward[2] * sinPitch,
            view.forward[1] * sinPitch + view.forward[2] * cosPitch
        ];
        const newUp = [
            view.up[0],
            view.up[1] * cosPitch - view.up[2] * sinPitch,
            view.up[1] * sinPitch + view.up[2] * cosPitch
        ];
        const newRight = [
            view.right[0],
            view.right[1] * cosPitch - view.right[2] * sinPitch,
            view.right[1] * sinPitch + view.right[2] * cosPitch
        ];
        
        view.forward = newForward;
        view.up = newUp;
        view.right = newRight;
    }
    
    if(yaw !== 0) {
        // Yaw 90° around world Y axis
        const newForward = [
            view.forward[0] * Math.cos(yaw * Math.PI / 180) - view.forward[2] * Math.sin(yaw * Math.PI / 180),
            view.forward[1],
            view.forward[0] * Math.sin(yaw * Math.PI / 180) + view.forward[2] * Math.cos(yaw * Math.PI / 180)
        ];
        const newUp = [
            view.up[0] * Math.cos(yaw * Math.PI / 180) - view.up[2] * Math.sin(yaw * Math.PI / 180),
            view.up[1],
            view.up[0] * Math.sin(yaw * Math.PI / 180) + view.up[2] * Math.cos(yaw * Math.PI / 180)
        ];
        const newRight = [
            view.right[0] * Math.cos(yaw * Math.PI / 180) - view.right[2] * Math.sin(yaw * Math.PI / 180),
            view.right[1],
            view.right[0] * Math.sin(yaw * Math.PI / 180) + view.right[2] * Math.cos(yaw * Math.PI / 180)
        ];
        
        view.forward = newForward;
        view.up = newUp;
        view.right = newRight;
    }
    
    if(roll !== 0) {
        // Roll 90° around world Z axis
        const newForward = [
            view.forward[0] * Math.cos(roll * Math.PI / 180) - view.forward[1] * Math.sin(roll * Math.PI / 180),
            view.forward[0] * Math.sin(roll * Math.PI / 180) + view.forward[1] * Math.cos(roll * Math.PI / 180),
            view.forward[2]
        ];
        const newUp = [
            view.up[0] * Math.cos(roll * Math.PI / 180) - view.up[1] * Math.sin(roll * Math.PI / 180),
            view.up[0] * Math.sin(roll * Math.PI / 180) + view.up[1] * Math.cos(roll * Math.PI / 180),
            view.up[2]
        ];
        const newRight = [
            view.right[0] * Math.cos(roll * Math.PI / 180) - view.right[1] * Math.sin(roll * Math.PI / 180),
            view.right[0] * Math.sin(roll * Math.PI / 180) + view.right[1] * Math.cos(roll * Math.PI / 180),
            view.right[2]
        ];
        
        view.forward = newForward;
        view.up = newUp;
        view.right = newRight;
    }
    
    // Orthonormalize to maintain clean basis
    view.forward = normalize(view.forward);
    view.right = normalize(cross(view.forward, view.up));
    view.up = normalize(cross(view.right, view.forward));
}

// Update movement & rotation
let lastTime = performance.now();
function updateCamera(time){
    const deltaTime = (time - lastTime)/1000;
    lastTime = time;

    // Apply Alt modifier for both movement and rotation
    let speedMultiplier = keys['AltLeft'] || keys['AltRight'] ? 10 : 1;

    const moveSpeed = BASE_MOVE_SPEED * speedMultiplier;
    const rotSpeed  = BASE_ROTATE_SPEED * speedMultiplier;

    const speed = moveSpeed * deltaTime;
    const rotDelta = rotSpeed * deltaTime;

    const {forward, right, up} = view;
    let moved=false;

    // --- Movement ---
    if(altPressed) {
        // Grid-based movement when Alt is pressed (still uses local axes)
        const currentTime = performance.now();
        if(currentTime - lastSnapTime >= SNAP_INTERVAL) {
            let gridMoved = false;
            
            if(keys['ArrowUp'])   { view.x+=forward[0]*GRID_SIZE; view.y+=forward[1]*GRID_SIZE; view.z+=forward[2]*GRID_SIZE; gridMoved = true; }
            if(keys['ArrowDown']) { view.x-=forward[0]*GRID_SIZE; view.y-=forward[1]*GRID_SIZE; view.z-=forward[2]*GRID_SIZE; gridMoved = true; }
            if(keys['ArrowLeft']) { view.x-=right[0]*GRID_SIZE;   view.y-=right[1]*GRID_SIZE;   view.z-=right[2]*GRID_SIZE; gridMoved = true; }
            if(keys['ArrowRight']){ view.x+=right[0]*GRID_SIZE;   view.y+=right[1]*GRID_SIZE;   view.z+=right[2]*GRID_SIZE; gridMoved = true; }
            if(keys['Space'])     { view.x+=up[0]*GRID_SIZE;      view.y+=up[1]*GRID_SIZE;      view.z+=up[2]*GRID_SIZE; gridMoved = true; }
            if(keys['ShiftLeft']) { view.x-=up[0]*GRID_SIZE;      view.y-=up[1]*GRID_SIZE;      view.z-=up[2]*GRID_SIZE; gridMoved = true; }
            
            if(gridMoved) {
                lastSnapTime = currentTime;
                moved = true;
            }
        }
    } else if(interactiveMode) {
        // Interactive mode movement - WASD, Space, Shift with collision detection
        // Use horizontal forward vector (ignore pitch for movement)
        const horizontalForward = [view.forward[0], 0, view.forward[2]];
        const normalizedForward = normalize(horizontalForward);
        
        // Pure vertical movement
        const verticalUp = [0, 1, 0];
        
        // Calculate potential new positions
        const currentPos = [view.x, view.y, view.z];
        let newPos = [...currentPos];
        
        if(keys['KeyW'])     { newPos[0]+=normalizedForward[0]*speed; newPos[2]+=normalizedForward[2]*speed; }
        if(keys['KeyS'])     { newPos[0]-=normalizedForward[0]*speed; newPos[2]-=normalizedForward[2]*speed; }
        if(keys['KeyA'])     { newPos[0]-=right[0]*speed;   newPos[2]-=right[2]*speed; }
        if(keys['KeyD'])     { newPos[0]+=right[0]*speed;   newPos[2]+=right[2]*speed; }
        if(keys['Space'])    { newPos[0]+=verticalUp[0]*speed; newPos[1]+=verticalUp[1]*speed; newPos[2]+=verticalUp[2]*speed; }
        if(keys['ShiftLeft']){ newPos[0]-=verticalUp[0]*speed; newPos[1]-=verticalUp[1]*speed; newPos[2]-=verticalUp[2]*speed; }
        
        // Check collision before applying movement
        // Only check new position if current position is not colliding (prevents getting stuck)
        const currentPosColliding = checkCollision(currentPos);
        
        if (!currentPosColliding) {
            // Check each movement component separately
            let movedX = false, movedY = false, movedZ = false;
            
            // Forward/Backward movement (XZ plane)
            if(keys['KeyW'] || keys['KeyS']) {
                const testPos = [...currentPos];
                if(keys['KeyW']) {
                    testPos[0] += normalizedForward[0]*speed;
                    testPos[2] += normalizedForward[2]*speed;
                }
                if(keys['KeyS']) {
                    testPos[0] -= normalizedForward[0]*speed;
                    testPos[2] -= normalizedForward[2]*speed;
                }
                if (!checkCollision(testPos)) {
                    view.x = testPos[0];
                    view.z = testPos[2];
                    movedX = true;
                }
            }
            
            // Left/Right movement (XZ plane)
            if(keys['KeyA'] || keys['KeyD']) {
                const testPos = [view.x, view.y, view.z]; // Use potentially updated position
                if(keys['KeyA']) {
                    testPos[0] -= right[0]*speed;
                    testPos[2] -= right[2]*speed;
                }
                if(keys['KeyD']) {
                    testPos[0] += right[0]*speed;
                    testPos[2] += right[2]*speed;
                }
                if (!checkCollision(testPos)) {
                    view.x = testPos[0];
                    view.z = testPos[2];
                    movedX = true;
                }
            }
            
            // Vertical movement (Y axis)
            if(keys['Space'] || keys['ShiftLeft']) {
                const testPos = [view.x, view.y, view.z]; // Use potentially updated position
                if(keys['Space']) {
                    testPos[1] += verticalUp[1]*speed;
                }
                if(keys['ShiftLeft']) {
                    testPos[1] -= verticalUp[1]*speed;
                }
                if (!checkCollision(testPos)) {
                    view.y = testPos[1];
                    movedY = true;
                }
            }
            
            if (movedX || movedY) moved = true;
        } else {
            // If currently colliding, allow movement to try to escape
            // This prevents getting permanently stuck
            view.x = newPos[0];
            view.y = newPos[1];
            view.z = newPos[2];
            moved = true;
        }
    } else {
        // Normal movement
        if(keys['ArrowUp'])   { view.x+=forward[0]*speed; view.y+=forward[1]*speed; view.z+=forward[2]*speed; moved=true; }
        if(keys['ArrowDown']) { view.x-=forward[0]*speed; view.y-=forward[1]*speed; view.z-=forward[2]*speed; moved=true; }
        if(keys['ArrowLeft']) { view.x-=right[0]*speed;   view.y-=right[1]*speed;   view.z-=right[2]*speed; moved=true; }
        if(keys['ArrowRight']){ view.x+=right[0]*speed;   view.y+=right[1]*speed;   view.z+=right[2]*speed; moved=true; }
        if(keys['Space'])     { view.x+=up[0]*speed;      view.y+=up[1]*speed;      view.z+=up[2]*speed; moved=true; }
        if(keys['ShiftLeft']) { view.x-=up[0]*speed;      view.y-=up[1]*speed;      view.z-=up[2]*speed; moved=true; }
    }

    // --- Rotation ---
    const rotated = interactiveMode ? false : updateCameraRotation(rotDelta);

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
