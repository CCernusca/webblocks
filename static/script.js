const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pointColorPicker = document.getElementById('point-color');
const strokeColorPicker = document.getElementById('stroke-color');

let points3D = [];
let edges = [];
let pointColor = '#0000ff';
let strokeColor = '#00ff00';

// --- Camera / View settings (new) ---
const view = {
    x: 0,       // camera/world x
    y: 0,       // camera/world y
    z: 0,       // camera/world z
    angleX: 0,  // camera pitch (degrees)
    angleY: 0,  // camera yaw (degrees)
    angleZ: 0,  // camera roll (degrees)
    fov: 90     // vertical field-of-view in degrees
};
// ------------------------------------------------

function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size;
    canvas.height = size;
    if (points3D.length > 0) {
        render();
    }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Fetch 3D points from Flask backend
fetch('/api/points')
    .then(res => res.json())
    .then(data => {
        points3D = data.points;
    });

// Fetch edges from Flask backend
fetch('/api/edges')
    .then(res => res.json())
    .then(data => {
        edges = data.edges;
        render();
    });

// Rotation matrix functions (object and camera rotations reuse these)
function rotateX(point, angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
        point[0],
        point[1] * cos - point[2] * sin,
        point[1] * sin + point[2] * cos
    ];
}

function rotateY(point, angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
        point[0] * cos + point[2] * sin,
        point[1],
        -point[0] * sin + point[2] * cos
    ];
}

function rotateZ(point, angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
        point[0] * cos - point[1] * sin,
        point[0] * sin + point[1] * cos,
        point[2]
    ];
}

// Project 3D point (in camera space) to normalized device coordinates [-1, 1]
function projectCameraSpace(camPoint) {
    // camPoint is [x,y,z] in camera coordinates (camera looks along +z)
    const eps = 1e-4;
    const z = camPoint[2] <= eps ? eps : camPoint[2];

    // compute focal length from vertical FOV and canvas height
    const fovRad = view.fov * Math.PI / 180;
    const focal = (canvas.height / 2) / Math.tan(fovRad / 2); // in pixels

    // projection to pixel coordinates (centered at 0,0)
    const xPixel = (camPoint[0] * focal) / z;
    const yPixel = (camPoint[1] * focal) / z;

    // convert to normalized device coords [-1, 1] (for reuse with your screen() helper)
    const xNDC = xPixel / (canvas.width / 2);
    const yNDC = yPixel / (canvas.height / 2);

    return { ndc: [xNDC, yNDC], z: z };
}

// Display projected (normalized) point correctly on screen
function screen(pointNdc) {
    // pointNdc is [xNDC, yNDC] in [-1,1] range
    return [
        ((pointNdc[0] + 1) / 2) * canvas.width,
        (1 - (pointNdc[1] + 1) / 2) * canvas.height
    ];
}

// Convert hex color to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Render all points and edges (uses camera/view)
function render() {
    if (!points3D || points3D.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Compute camera-space position for each point:
    // 1) apply object rotation (angleX/Y/Z)
    // 2) translate into camera space (point - view.position)
    // 3) rotate by negative camera angles (i.e. bring world into camera orientation)
    const cameraSpacePoints = points3D.map(pt => {
        let p = [...pt];

        // translate relative to camera position
        let cx = p[0] - view.x;
        let cy = p[1] - view.y;
        let cz = p[2] - view.z;

        // rotate by negative camera angles (camera orientation)
        let cp = rotateX([cx, cy, cz], -view.angleX);
        cp = rotateY(cp, -view.angleY);
        cp = rotateZ(cp, -view.angleZ);

        // NOTE: convention chosen: camera looks along positive Z in camera space.
        return cp; // [x_cam, y_cam, z_cam]
    });

    // Project each camera-space point to NDC and then to screen pixels
    const projected = cameraSpacePoints.map(cp => projectCameraSpace(cp));
    const pixelPoints = projected.map(p => screen(p.ndc));

    // Sort indices by camera-space depth (z) descending so farther points are drawn first
    const sortedIndices = projected
        .map((p, i) => ({ z: p.z, i }))
        .sort((a, b) => b.z - a.z)
        .map(x => x.i);

    // Draw edges (use pixelPoints)
    ctx.strokeStyle = hexToRgba(strokeColor, 0.6);
    ctx.lineWidth = 2;
    edges.forEach(edge => {
        const p1 = pixelPoints[edge[0]];
        const p2 = pixelPoints[edge[1]];
        // If either endpoint projects to NaN or outside reasonable z, skip
        if (!p1 || !p2 || !isFinite(p1[0]) || !isFinite(p2[0])) return;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
    });

    // Draw points in depth-sorted order
    ctx.fillStyle = pointColor;
    const size = 8;
    for (let k = 0; k < sortedIndices.length; k++) {
        const idx = sortedIndices[k];
        const p = pixelPoints[idx];
        if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue;
        ctx.beginPath();
        ctx.arc(p[0], p[1], size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Event listeners for color pickers
pointColorPicker.addEventListener('input', (e) => {
    pointColor = e.target.value;
    render();
});

strokeColorPicker.addEventListener('input', (e) => {
    strokeColor = e.target.value;
    render();
});

// --- Utility API to change camera/view at runtime ---
// Call these from your other code / devtools, then call render().

function setViewPosition(x, y, z) {
    view.x = x;
    view.y = y;
    view.z = z;
    render();
}

function setViewAngles(ax, ay, az) {
    view.angleX = ax;
    view.angleY = ay;
    view.angleZ = az;
    render();
}

function setFov(deg) {
    view.fov = deg;
    render();
}

// expose to window for quick debugging
window.setViewPosition = setViewPosition;
window.setViewAngles = setViewAngles;
window.setFov = setFov;
window.view = view;
window.objectAngles = { get angleX() { return angleX; }, get angleY() { return angleY; }, get angleZ() { return angleZ; } };

// initial render if we already loaded edges/points
render();
