const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const rotXSlider = document.getElementById('rot-x');
const rotYSlider = document.getElementById('rot-y');
const rotZSlider = document.getElementById('rot-z');
const rotXValue = document.getElementById('rotx-value');
const rotYValue = document.getElementById('roty-value');
const rotZValue = document.getElementById('rotz-value');

let points3D = [];
let angleX = 0;
let angleY = 0;
let angleZ = 0;

// Set canvas size
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Fetch 3D points from Flask backend
fetch('/api/points')
    .then(res => res.json())
    .then(data => {
        points3D = data.points;
        render();
    });

// Rotation matrix functions
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

// Project 3D point to 2D
function project(point) {
    const distance = 500;
    const z = point[2] + distance;
    const scale = distance / z;
    return [
        point[0] * scale + canvas.width / 2,
        point[1] * scale + canvas.height / 2,
        z
    ];
}

// Render all points
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const projectedPoints = points3D.map(point => {
        let p = [...point];
        p = rotateX(p, angleX);
        p = rotateY(p, angleY);
        p = rotateZ(p, angleZ);
        return project(p);
    });
    
    // Sort by z-depth for proper rendering
    const sortedPoints = projectedPoints
        .map((p, i) => ({x: p[0], y: p[1], z: p[2], idx: i}))
        .sort((a, b) => b.z - a.z);
    
    // Draw connections between cube vertices
    const edges = [
        [0, 1], [1, 3], [3, 2], [2, 0], // back face
        [4, 5], [5, 7], [7, 6], [6, 4], // front face
        [0, 4], [1, 5], [2, 6], [3, 7]  // connecting edges
    ];
    
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 2;
    edges.forEach(edge => {
        const p1 = projectedPoints[edge[0]];
        const p2 = projectedPoints[edge[1]];
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
    });
    
    // Draw points
    sortedPoints.forEach(p => {
        const size = 8;
        const opacity = Math.max(0.3, 1 - (1000 - p.z) / 1000);
        ctx.fillStyle = `rgba(102, 126, 234, ${opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// Event listeners for sliders
rotXSlider.addEventListener('input', (e) => {
    angleX = parseFloat(e.target.value);
    rotXValue.textContent = angleX;
    render();
});

rotYSlider.addEventListener('input', (e) => {
    angleY = parseFloat(e.target.value);
    rotYValue.textContent = angleY;
    render();
});

rotZSlider.addEventListener('input', (e) => {
    angleZ = parseFloat(e.target.value);
    rotZValue.textContent = angleZ;
    render();
});