from flask import Flask, render_template, jsonify
import math

app = Flask(__name__)

# Generate sample 3D points (a cube)
def generate_cube_points():
    points = []
    size = 50
    for x in [-size, size]:
        for y in [-size, size]:
            for z in [-size, size]:
                points.append([x, y - 100, z + 150])
    return points

def generate_cube_edges():
    edges = [
        [0, 1], [1, 3], [3, 2], [2, 0], # back face
        [4, 5], [5, 7], [7, 6], [6, 4], # front face
        [0, 4], [1, 5], [2, 6], [3, 7]  # connecting edges
    ]
    return edges

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/points')
def get_points():
    points = generate_cube_points()
    return jsonify({'points': points})

@app.route('/api/edges')
def get_edges():
    edges = generate_cube_edges()
    return jsonify({'edges': edges})

if __name__ == '__main__':
    app.run(debug=True, port=5000)