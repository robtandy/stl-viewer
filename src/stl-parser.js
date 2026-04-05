import fs from 'fs';

/**
 * Parse an STL file (binary or ASCII) and return vertices, normals, and triangles
 * in three-cad-viewer format.
 */
export function parseSTL(filePath) {
    const buffer = fs.readFileSync(filePath);
    const isBinary = detectBinary(buffer);
    
    if (isBinary) {
        return parseBinarySTL(buffer);
    } else {
        return parseAsciiSTL(buffer.toString('utf-8'));
    }
}

function detectBinary(buffer) {
    // Binary STL starts with 80 bytes header, then 4 bytes for triangle count
    if (buffer.length < 84) return false;
    
    // Check if file starts with "solid" - indicates ASCII format
    const header = buffer.slice(0, 5).toString('ascii');
    if (header === 'solid') {
        // Could still be binary if it starts with "solid " but is actually binary
        // Check if it contains "facet" keyword which would indicate ASCII
        const content = buffer.toString('ascii');
        if (content.includes('facet normal') && content.includes('vertex')) {
            return false; // Definitely ASCII
        }
    }
    
    // Check for binary signature: header + triangle count + triangles
    const triangleCount = buffer.readUInt32LE(80);
    const expectedSize = 84 + triangleCount * 50;
    
    // If sizes match reasonably, assume binary
    return Math.abs(buffer.length - expectedSize) < 100;
}

function parseBinarySTL(buffer) {
    const triangleCount = buffer.readUInt32LE(80);
    const vertices = [];
    const normals = [];
    const triangles = [];
    const edges = [];
    
    let vertexIndex = 0;
    
    for (let i = 0; i < triangleCount; i++) {
        const offset = 84 + i * 50;
        
        // Read normal (3 floats)
        const nx = buffer.readFloatLE(offset);
        const ny = buffer.readFloatLE(offset + 4);
        const nz = buffer.readFloatLE(offset + 8);
        
        // Read 3 vertices (9 floats)
        for (let j = 0; j < 3; j++) {
            const vOffset = offset + 12 + j * 12;
            vertices.push(
                buffer.readFloatLE(vOffset),
                buffer.readFloatLE(vOffset + 4),
                buffer.readFloatLE(vOffset + 8)
            );
            normals.push(nx, ny, nz);
        }
        
        // Add triangle indices
        triangles.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        
        // Add edges (each edge connects consecutive vertices)
        edges.push(
            vertexIndex, vertexIndex + 1,
            vertexIndex + 1, vertexIndex + 2,
            vertexIndex + 2, vertexIndex
        );
        
        vertexIndex += 3;
    }
    
    return { vertices, normals, triangles, edges };
}

function parseAsciiSTL(content) {
    const vertices = [];
    const normals = [];
    const triangles = [];
    const edges = [];
    
    // Match vertex lines
    const vertexRegex = /vertex\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
    const normalRegex = /facet normal\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
    
    const normalMatches = [...content.matchAll(normalRegex)];
    const vertexMatches = [...content.matchAll(vertexRegex)];
    
    let vertexIndex = 0;
    let triangleIndex = 0;
    
    for (let i = 0; i < normalMatches.length; i++) {
        const normal = [
            parseFloat(normalMatches[i][1]),
            parseFloat(normalMatches[i][2]),
            parseFloat(normalMatches[i][3])
        ];
        
        // Each triangle has 3 vertices
        for (let j = 0; j < 3; j++) {
            const vIdx = i * 3 + j;
            const vMatch = vertexMatches[vIdx];
            if (vMatch) {
                vertices.push(
                    parseFloat(vMatch[1]),
                    parseFloat(vMatch[2]),
                    parseFloat(vMatch[3])
                );
                normals.push(normal[0], normal[1], normal[2]);
            }
        }
        
        // Add triangle
        triangles.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        
        // Add edges
        edges.push(
            vertexIndex, vertexIndex + 1,
            vertexIndex + 1, vertexIndex + 2,
            vertexIndex + 2, vertexIndex
        );
        
        vertexIndex += 3;
    }
    
    return { vertices, normals, triangles, edges };
}

/**
 * Convert parsed STL data to three-cad-viewer format
 */
export function stlToShapeData(stlData, name) {
    const { vertices, normals, triangles, edges } = stlData;
    
    // Compute bounding box
    let xmin = Infinity, xmax = -Infinity;
    let ymin = Infinity, ymax = -Infinity;
    let zmin = Infinity, zmax = -Infinity;
    
    for (let i = 0; i < vertices.length; i += 3) {
        xmin = Math.min(xmin, vertices[i]);
        xmax = Math.max(xmax, vertices[i]);
        ymin = Math.min(ymin, vertices[i + 1]);
        ymax = Math.max(ymax, vertices[i + 1]);
        zmin = Math.min(zmin, vertices[i + 2]);
        zmax = Math.max(zmax, vertices[i + 2]);
    }
    
    // Flatten edges into a 1D array of [x,y,z,x,y,z,...]
    const flattenedEdges = [];
    for (let i = 0; i < edges.length; i += 2) {
        flattenedEdges.push(
            vertices[edges[i] * 3],
            vertices[edges[i] * 3 + 1],
            vertices[edges[i] * 3 + 2],
            vertices[edges[i + 1] * 3],
            vertices[edges[i + 1] * 3 + 1],
            vertices[edges[i + 1] * 3 + 2]
        );
    }
    
    return {
        id: `/Group/${name}`,
        type: "shapes",
        subtype: "solid",
        name: name,
        shape: {
            vertices,
            triangles,
            normals,
            edges: flattenedEdges,
        },
        state: [1, 1],
        color: "#e8b024",
        alpha: 1.0,
        texture: null,
        loc: [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ],
        renderback: false,
        accuracy: null,
        bb: {
            xmin, xmax, ymin, ymax, zmin, zmax
        }
    };
}

/**
 * Build the full shapes object for three-cad-viewer
 */
export function buildShapesObject(partData, filePath) {
    const name = filePath.split('/').pop().replace('.stl', '').replace('.STL', '');
    
    const shapes = {
        version: 3,
        parts: [partData],
        loc: [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ],
        name: "Group",
        id: "/Group",
        normal_len: 0,
        bb: partData.bb
    };
    
    return shapes;
}
