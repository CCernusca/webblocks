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
                points.append([x, y, z + 500])
    return points

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/points')
def get_points():
    points = generate_cube_points()
    return jsonify({'points': points})

if __name__ == '__main__':
    app.run(debug=True, port=5000)