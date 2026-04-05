import express from 'express';
import { createServer } from 'http';
import { parseSTL, stlToShapeData, buildShapesObject } from './src/stl-parser.js';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = 3000;

// Store the current STL file path and data
let currentStlPath = null;
let currentShapesData = null;
let watcher = null;

// Serve static files from public directory
app.use(express.static('public'));

// Also serve node_modules for three-cad-viewer
app.use('/node_modules', express.static('node_modules'));

// Serve raw STL files
app.use('/stl', express.static(process.cwd()));

// API endpoint to get STL data
app.get('/api/stl', (req, res) => {
    if (!currentStlPath) {
        return res.status(404).json({ error: 'No STL file loaded' });
    }
    
    try {
        const stlData = parseSTL(currentStlPath);
        const partData = stlToShapeData(stlData, path.basename(currentStlPath));
        currentShapesData = buildShapesObject(partData, currentStlPath);
        
        res.json({
            shapes: currentShapesData,
            filePath: currentStlPath
        });
    } catch (error) {
        console.error('Error parsing STL:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get current file path
app.get('/api/file', (req, res) => {
    res.json({
        filePath: currentStlPath,
        exists: currentStlPath ? true : false
    });
});

// API endpoint to watch a file
app.get('/api/watch', (req, res) => {
    const filePath = req.query.path;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    const absolutePath = path.resolve(filePath);
    
    // Close existing watcher
    if (watcher) {
        watcher.close();
    }
    
    currentStlPath = absolutePath;
    
    // Watch the file for changes
    watcher = chokidar.watch(absolutePath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50
        }
    });
    
    watcher.on('change', () => {
        console.log(`File changed: ${absolutePath}`);
        // The frontend will poll or be notified
    });
    
    console.log(`Watching file: ${absolutePath}`);
    
    res.json({
        watching: true,
        filePath: absolutePath
    });
});

// SSE endpoint for file change notifications
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial connection message
    res.write('event: connected\ndata: {}\n\n');
    
    // Check for file changes periodically
    let lastModified = null;
    
    const checkInterval = setInterval(() => {
        if (currentStlPath && watcher) {
            // Poll the watcher state
            watcher.on('change', (changedPath) => {
                if (changedPath === currentStlPath) {
                    console.log(`File changed: ${currentStlPath}`);
                    res.write('event: fileChanged\ndata: {}\n\n');
                }
            });
        }
    }, 500);
    
    req.on('close', () => {
        clearInterval(checkInterval);
    });
});

// Endpoint to stop watching
app.get('/api/stop-watch', (req, res) => {
    if (watcher) {
        watcher.close();
        watcher = null;
    }
    res.json({ watching: false });
});

function startServer(stlFilePath) {
    if (stlFilePath) {
        const absolutePath = path.resolve(stlFilePath);
        
        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            console.error(`Error: File not found: ${absolutePath}`);
        } else {
            currentStlPath = absolutePath;
            console.log(`Loading STL file: ${absolutePath}`);
            
            // Set up file watcher
            watcher = chokidar.watch(absolutePath, {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 100,
                    pollInterval: 50
                }
            });
            
            watcher.on('change', () => {
                console.log(`File changed: ${absolutePath}`);
            });
        }
    }
    
    server.listen(PORT, () => {
        console.log(`STL Viewer running at http://localhost:${PORT}`);
        if (currentStlPath) {
            console.log(`Watching file: ${currentStlPath}`);
        } else {
            console.log('No file loaded. Run with: npm start path/to/file.stl');
        }
    });
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
    startServer(args[0]);
} else {
    startServer(null);
}
