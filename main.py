from flask import Flask, render_template, jsonify, send_from_directory
import json
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/world')
def get_world():
    try:
        with open('world.json', 'r') as f:
            world_data = json.load(f)
        return jsonify(world_data)
    except FileNotFoundError:
        return jsonify({'error': 'world.json not found'}), 404
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON in world.json'}), 400

@app.route('/api/structure/<structure_name>')
def get_structure(structure_name):
    try:
        structure_path = os.path.join('structures', f'{structure_name}.json')
        with open(structure_path, 'r') as f:
            structure_data = json.load(f)
        return jsonify(structure_data)
    except FileNotFoundError:
        return jsonify({'error': f'Structure "{structure_name}" not found'}), 404
    except json.JSONDecodeError:
        return jsonify({'error': f'Invalid JSON in {structure_name}.json'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)