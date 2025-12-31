const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pointColorPicker = document.getElementById('point-color');
const strokeColorPicker = document.getElementById('stroke-color');

let points3D = [];
let angleX = 0;
let angleY = 0;
let angleZ = 0;
let pointColor = '#0000ff';
let strokeColor = '#00ff00';

// Set canvas size to be square and as large as possible
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
    return [
        point[0] / point[2],
        point[1] / point[2]
    ];
}

// Display projected point correctly on screen
function screen(point) {
    return [
        ((point[0] + 1) / 2) * canvas.width,
        (1 - (point[1] + 1) / 2) * canvas.height
    ]
}

// Convert hex color to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Render all points
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const projectedPoints = points3D.map(point => {
        let p = [...point];
        p = rotateX(p, angleX);
        p = rotateY(p, angleY);
        p = rotateZ(p, angleZ);
        return project(p);
    });

    const screenedPoints = projectedPoints.map(point => {
        let p = [...point];
        p = screen(p);
        return p;
    })
    
    // Sort by z-depth for proper rendering
    const sortedPoints = screenedPoints
        .map((p, i) => ({x: p[0], y: p[1], z: p[2], idx: i}))
        .sort((a, b) => b.z - a.z);
    
    // Draw connections between cube vertices
    const edges = [
        [0, 1], [1, 3], [3, 2], [2, 0], // back face
        [4, 5], [5, 7], [7, 6], [6, 4], // front face
        [0, 4], [1, 5], [2, 6], [3, 7]  // connecting edges
    ];
    
    ctx.strokeStyle = hexToRgba(strokeColor, 0.6);
    ctx.lineWidth = 2;
    edges.forEach(edge => {
        const p1 = screenedPoints[edge[0]];
        const p2 = screenedPoints[edge[1]];
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
    });
    
    // Draw points
    sortedPoints.forEach(p => {
        const size = 8;
        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
    });
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