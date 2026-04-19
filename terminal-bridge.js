/**
 * HOTELTRIZ MASTER BRIDGE v1.0
 * Gestor de Procesos para Desarrollo Local (Prisma 7 + LibSQL)
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3050; // Puerto diferente para no chocar con Reyval si ambos están abiertos
const processes = {
    server: { child: null, state: 'stopped', logs: [] },
    client: { child: null, state: 'stopped', logs: [] },
    db: { child: null, state: 'stopped', logs: [] },
    git_push: { child: null, state: 'stopped', logs: [] },
    server_deploy: { child: null, state: 'stopped', logs: [] }
};

const clients = new Set();

function broadcast(type, data) {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => client.write(payload));
}

function addLog(app, content) {
    const logEntry = {
        time: new Date().toLocaleTimeString(),
        content: content.toString().trim()
    };
    processes[app].logs.push(logEntry);
    if (processes[app].logs.length > 500) processes[app].logs.shift();
    broadcast('log', { app, ...logEntry });
}

function updateState(app, state) {
    processes[app].state = state;
    broadcast('state-change', { app, state });
}

function runCommand(app, cmd, args, cwd) {
    if (processes[app].state === 'running' && app !== 'db') {
        addLog(app, `[Warning] ${app} ya se está ejecutando.`);
        return;
    }

    addLog(app, `Ejecutando: ${cmd} ${args.join(' ')}`);
    if (app !== 'db') updateState(app, 'running');

    const env = { ...process.env, PATH: process.env.PATH + ':/usr/local/bin' };
    
    // Workaround for permission issues in some environments
    if (cmd === 'npx' || cmd === 'npm') {
        env.XDG_CACHE_HOME = path.join(__dirname, '.cache');
    }

    const child = spawn(cmd, args, {
        cwd: path.join(__dirname, cwd),
        shell: true,
        env
    });

    child.stdout.on('data', (data) => addLog(app, data));
    child.stderr.on('data', (data) => addLog(app, `[ERR] ${data}`));

    child.on('close', (code) => {
        if (app !== 'db') updateState(app, 'stopped');
        processes[app].child = null;
        addLog(app, `Proceso finalizado con código ${code}`);
    });

    if (app !== 'db') processes[app].child = child;
}

function stopProcess(app) {
    if (processes[app].child) {
        addLog(app, `Deteniendo ${app}...`);
        processes[app].child.kill();
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/events') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write('\n');
        clients.add(res);
        res.write(`event: init\ndata: ${JSON.stringify({
            server: { state: processes.server.state },
            client: { state: processes.client.state },
            db: { state: processes.db.state },
            git_push: { state: processes.git_push.state },
            server_deploy: { state: processes.server_deploy.state }
        })}\n\n`);
        req.on('close', () => clients.delete(res));
        return;
    }

    const app = url.searchParams.get('app');
    const cmdType = url.searchParams.get('cmd');

    if (url.pathname === '/run') {
        if (app === 'server') runCommand('server', 'node', ['src/index.js'], 'server');
        else if (app === 'client') runCommand('client', 'npm', ['run', 'dev'], 'client');
        else if (app === 'db') {
            if (cmdType === 'push') runCommand('db', 'npx', ['prisma', 'db', 'push'], 'server');
            if (cmdType === 'seed') runCommand('db', 'node', ['prisma/seed.js'], 'server');
            if (cmdType === 'gen') runCommand('db', 'npx', ['prisma', 'generate'], 'server');
        }
        else if (app === 'git_push') {
            const gitMsg = cmdType || 'Update from Terminal';
            const gitCmd = `git add . && git commit -m "${gitMsg}" && git push origin main`;
            runCommand('git_push', gitCmd, [], '.');
        }
        else if (app === 'server_deploy') {
            const deployCmd = `ssh -i /Users/franivan/Documents/ProyectosWeb/AbTech/ssh-key-2026-01-09.key -o StrictHostKeyChecking=no ubuntu@143.47.101.209 "cd /home/ubuntu/HotelTriz && git pull && cd client && npm run build && pm2 restart all"`;
            runCommand('server_deploy', deployCmd, [], '.');
        }
        res.end('OK');
        return;
    }

    if (url.pathname === '/stop') {
        if (processes[app]) stopProcess(app);
        res.end('OK');
        return;
    }

    res.statusCode = 404;
    res.end();
});

server.listen(PORT, () => {
    console.log(`HOTELTRIZ BRIDGE ACTIVE en puerto ${PORT}`);
});
