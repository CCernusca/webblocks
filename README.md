# WebBlocks

This is a little project which experiments with the rendering of and interaction with 3D structures in a web browser using HTML, CSS and JavaScript. The website is hosted using Python and Flask. It aims to include most basic features of Minecraft, such as a block-based environment, player characters which are able to navigate through this environment, and the ability to manipulate the environment through the placing and breaking of blocks.

## Features

- Hosting a website using Python and Flask
- Projecting 3D structures to a 2D plane without libraries
- Structures refer to groups of points connected by edges (wireframes)
- Color selection for rendering details
- POV Camera with full 6-DOF movement
- Movement (Translation) is controlled using the arrow keys, space and left shift.
- Rotation (Rotation) is controlled using the WASD keys, Q and E.
- Ctrl can be pressed to increase the speed of movement and rotation.
- More to come...

## Showcase

![alt text](assets\showcase\image.png)
*Screenshot of the current state of the project*

## Installation

Python 3.13 is required to run this project, and the use of a virtual environment is recommended.
The required libraries can be installed using pip.

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

The website can be started by running the main.py file. Afterwards, it can be accessed through http://localhost:5000.
