const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((request, response) => {
    let filePath = '.' + request.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    if (request.method === 'POST' && request.url === '/api/save-client') {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            try {
                const clientData = JSON.parse(body);
                clientData.fechaGuardado = new Date().toISOString();
                
                const clientesPath = path.join(__dirname, 'data', 'clientes.json');
                let clientes = [];
                
                // Asegurarse de que la carpeta data exista
                const dirPath = path.join(__dirname, 'data');
                if (!fs.existsSync(dirPath)){
                    fs.mkdirSync(dirPath);
                }

                if (fs.existsSync(clientesPath)) {
                    const fileContent = fs.readFileSync(clientesPath, 'utf8');
                    if (fileContent) {
                        try { clientes = JSON.parse(fileContent); } catch(e) {}
                    }
                }
                
                clientes.push(clientData);
                fs.writeFileSync(clientesPath, JSON.stringify(clientes, null, 2), 'utf8');
                
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: true, message: 'Cliente guardado correctamente' }));
            } catch (error) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, message: 'Bad request' }));
            }
        });
        return; // Detener flujo para no servir archivos estáticos
    }


    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                fs.readFile('./404.html', (error, content) => {
                    response.writeHead(404, { 'Content-Type': 'text/html' });
                    response.end(content || '404 - Not Found', 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
