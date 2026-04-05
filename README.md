# STL Viewer

A simple STL file viewer using [three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer).

## Features

- View STL files (ASCII and binary format)
- Auto-reload when the STL file changes
- Interactive 3D viewer with rotate, pan, and zoom

## Installation

```bash
npm install
```

## Usage

```bash
npm start path/to/your/file.stl
```

For example:
```bash
npm start /Users/me/Desktop/thing.stl
npm start ./models/cube.stl
```

The viewer will open at http://localhost:3000

## Hot Reload

The viewer automatically watches the STL file for changes. When the file is modified, the view will automatically reload. You can also click the "Reload" button to manually refresh.

## Development

```bash
# Run with file watching for server restarts
npm run start:watch path/to/file.stl
```
