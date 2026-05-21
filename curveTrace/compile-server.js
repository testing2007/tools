const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 4000;

const serveMode = process.argv.includes('--serve');
const noOpen = process.argv.includes('--no-open') || serveMode;
const noClose = process.argv.includes('--no-close') || serveMode;

const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
        let urlPath = req.url.split('?')[0];
        let filePath = '.' + urlPath;
        if (urlPath === '/' || urlPath === '/compiler') {
            filePath = './compiler.html';
        }

        // Resolve absolute path and prevent directory traversal
        const absPath = path.resolve(filePath);
        const workspacePath = path.resolve('.');

        if (!absPath.startsWith(workspacePath)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        fs.readFile(absPath, (err, content) => {
            if (err) {
                console.log(`[GET] 404 - ${req.url}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found: ' + urlPath);
            } else {
                let contentType = 'text/html';
                const ext = path.extname(absPath).toLowerCase();
                if (ext === '.png') contentType = 'image/png';
                else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                else if (ext === '.js') contentType = 'application/javascript';
                else if (ext === '.mp4') contentType = 'video/mp4';
                else if (ext === '.css') contentType = 'text/css';
                else if (ext === '.mind') contentType = 'application/octet-stream';

                console.log(`[GET] 200 - ${req.url} (${contentType})`);
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                });
                res.end(content);
            }
        });
    } else if (req.method === 'POST' && req.url === '/save-mind') {
        let body = [];
        req.on('data', chunk => body.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(body);
            try {
                // Ensure assets directory exists
                if (!fs.existsSync('./assets')) {
                    fs.mkdirSync('./assets');
                }
                fs.writeFileSync('./assets/targets.mind', buffer);
                console.log('Successfully saved targets.mind to assets/targets.mind!');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Saved successfully');
            } catch (err) {
                console.error('Failed to save targets.mind:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Failed to save file: ' + err.message);
            }

            // Auto close server
            if (!noClose) {
                setTimeout(() => {
                    console.log('Shutting down server...');
                    process.exit(0);
                }, 1000);
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`Compilation server running at http://localhost:${PORT}/compiler.html`);
    if (serveMode) {
        console.log(`Preview/AR page available at http://localhost:${PORT}/impl.html`);
    } else {
        console.log(`Opening browser to begin automatic compilation...`);
    }
    console.log(`==================================================\n`);

    // Automatically open browser
    if (!noOpen) {
        const url = `http://localhost:${PORT}/compiler.html`;
        const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
        exec(`${start} "${url}"`);
    }
});
