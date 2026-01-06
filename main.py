from flask import Flask, render_template, jsonify, send_from_directory, request
import json
import os
import atexit
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)

# In-memory cache for world data
world_cache = None

def load_world_from_file():
    """Load world data from world.json file"""
    try:
        with open('world.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None

def save_world_to_file():
    """Save current world state to world.json file"""
    global world_cache
    
    if world_cache is None:
        print("No world data to save")
        return
    
    try:
        with open('world.json', 'w') as f:
            json.dump(world_cache, f, indent=2)
        print("World state saved to world.json")
    except Exception as e:
        print(f"Failed to save world state: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/world')
def get_world():
    global world_cache
    
    # If world is not in memory, try to load from file
    if world_cache is None:
        world_cache = load_world_from_file()
        
        if world_cache is None:
            return jsonify({'error': 'world.json not found or invalid JSON'}), 404
    
    return jsonify(world_cache)

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

@app.route('/api/add_structure', methods=['POST'])
def add_structure():
    global world_cache
    
    # Ensure world is loaded
    if world_cache is None:
        world_cache = load_world_from_file()
        if world_cache is None:
            return jsonify({'error': 'World not loaded'}), 500
    
    try:
        data = request.get_json()
        if not data or 'position' not in data or 'structure' not in data:
            return jsonify({'error': 'Missing position or structure data'}), 400
        
        position = data['position']
        structure_name = data['structure']
        
        # Validate position format (should be [x, y, z])
        if not isinstance(position, list) or len(position) != 3:
            return jsonify({'error': 'Invalid position format'}), 400
        
        # Create position key
        pos_key = f"{position[0]},{position[1]},{position[2]}"
        
        # Add structure to world cache
        world_cache[pos_key] = structure_name
        
        return jsonify({'success': True, 'position': position, 'structure': structure_name})
        
    except Exception as e:
        return jsonify({'error': f'Failed to add structure: {str(e)}'}), 500

@app.route('/api/remove_structure', methods=['POST'])
def remove_structure():
    global world_cache
    
    # Ensure world is loaded
    if world_cache is None:
        world_cache = load_world_from_file()
        if world_cache is None:
            return jsonify({'error': 'World not loaded'}), 500
    
    try:
        data = request.get_json()
        if not data or 'position' not in data:
            return jsonify({'error': 'Missing position data'}), 400
        
        position = data['position']
        
        # Validate position format (should be [x, y, z])
        if not isinstance(position, list) or len(position) != 3:
            return jsonify({'error': 'Invalid position format'}), 400
        
        # Create position key
        pos_key = f"{position[0]},{position[1]},{position[2]}"
        
        # Remove structure from world cache
        removed_structure = world_cache.pop(pos_key, None)
        
        if removed_structure is None:
            return jsonify({'error': 'No structure found at this position'}), 404
        
        return jsonify({'success': True, 'position': position, 'removed_structure': removed_structure})
        
    except Exception as e:
        return jsonify({'error': f'Failed to remove structure: {str(e)}'}), 500

if __name__ == '__main__':
    # Set up background scheduler for periodic world saving
    scheduler = BackgroundScheduler()
    
    # Schedule world save every 10 minutes
    scheduler.add_job(
        func=save_world_to_file,
        trigger='interval',
        minutes=10,
        id='world_save_job'
    )
    
    # Register save function to run on server shutdown
    atexit.register(save_world_to_file)
    
    # Start the scheduler
    scheduler.start()
    
    print("World auto-save scheduler started (every 10 minutes)")
    print("World will also be saved on server shutdown")
    
    try:
        app.run(debug=True, port=5000)
    except (KeyboardInterrupt, SystemExit):
        # Ensure scheduler is shut down
        scheduler.shutdown()
        print("Server shutdown complete")