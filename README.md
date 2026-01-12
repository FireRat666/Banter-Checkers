# BanterCheckers

A multiplayer checkers game designed for **BanterVR**, built with **Banter Space State** (Serverless).

## Features
- **3D Checkers Board**: Traditional 8x8 checkers board with geometric pieces
- **Real-time Multiplayer**: Synchronizes moves between players using Banter's Space State
- **Standard Rules**: American checkers with forced jumps, multi-jumps, and king promotion
- **BanterVR Ready**: Embeddable in any Banter space with customizable positioning and scaling
- **Serverless**: Runs entirely client-side, no backend server required

## Prerequisites
- A web host (GitHub Pages, Netlify, Vercel, etc.) or a local web server for testing.

## Installation

1.  Clone the repository.
2.  That's it! No build process is required.

## Usage

1.  **Local Testing**:
    Serve the `public` folder using a local web server (e.g., Live Server in VS Code, or `python -m http.server`).

2.  **How to Play Checkers**:
    - **Click a piece** to select it (green highlight shows selected piece, blue highlights show valid moves)
    - **Click a valid square** (blue highlight) to move
    - **Jumps**: You must jump (capture) opponent pieces if possible
    - **Multi-jumps**: If you can continue jumping after a capture, you must do so
    - **King Promotion**: Pieces reaching the opposite end become kings (shown with gold crown)
    - **Kings**: Can move and jump both forward and backward
    
## Project Structure
- `js/embed.js`: Checkers game logic and Banter integration

## BanterVR Integration

To embed in BanterVR, add the embed script to your space's HTML. The game will automatically synchronize between all players in the space.

### Basic Embedding

Add this to your Banter space HTML:
```html
<script src="https://banter-checkers.firer.at/checkers.js"></script>
```

### Configuration

Customize the board's position, rotation, and scale using URL parameters:

```html
<script src="https://banter-checkers.firer.at/checkers.js?boardPosition=0+1.1+-2&boardScale=1.5&boardRotation=0+45+0"></script>
```

**Available Parameters:**
- `boardPosition`: Board position in 3D space as `x y z` (Default: `0 1.1 -2`)
- `boardRotation`: Board rotation as `x y z` degrees (Default: `0 0 0`)
- `boardScale`: Board scale as single value or `x y z` (Default: `1`)
- `resetPosition`: Reset button position relative to board as `x y z` (Default: `0 0 2.5`)
- `resetRotation`: Reset button rotation as `x y z` degrees (Default: `0 0 0`)
- `resetScale`: Reset button scale as single value or `x y z` (Default: `1`)
- `hideUI`: Set to `true` to hide the reset button (Default: `false`)
- `instance`: Custom instance/room identifier (Default: current URL)
- `HideBoard`: If `true`, hides the game board. (Default: `false`)
- `useCustomModels`: If `true`, uses custom GLB models for the pieces instead of the default spheres. (Default: `false`)
- `lighting`: Set to `lit` to use physically-based lit materials that respond to scene lights. (Default: `unlit`)
- `addLights`: When `lighting=lit`, this controls whether a default directional light is added. Set to `false` if you have your own lights. (Default: `true`)

### Examples

**Multiple boards in the same space:**
```html
<!-- Board 1: Center -->
<script src="https://banter-checkers.firer.at/checkers.js?instance=board1&boardPosition=0+1+-2"></script>

<!-- Board 2: To the right -->
<script src="https://banter-checkers.firer.at/checkers.js?instance=board2&boardPosition=3+1+-2"></script>
```

**Rotated board:**
```html
<script src="https://banter-checkers.firer.at/checkers.js?boardRotation=0+45+0"></script>
```

**Larger board without UI:**
```html
<script src="https://banter-checkers.firer.at/checkers.js?boardScale=2&hideUI=true"></script>
```

## License

MIT
