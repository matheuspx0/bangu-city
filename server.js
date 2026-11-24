const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Estado compartilhado da sala
const players = new Map();
let ballState = {
  x: -9,
  y: 0.12,
  z: -1.5,
  vx: 0,
  vy: 0,
  vz: 0,
  goals: 0
};

function broadcast(data, exceptWs = null) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client !== exceptWs) {
      client.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  const id = 'p_' + Math.random().toString(36).slice(2, 9);
  players.set(id, {
    id,
    charId: 'armando',
    x: -13 + (Math.random() * 4 - 2),
    y: 0.12,
    z: 4 + (Math.random() * 4 - 2),
    ry: 0,
    moving: false,
    running: false
  });

  // Envia estado inicial ao novo jogador
  ws.send(JSON.stringify({
    type: 'init',
    id,
    players: Array.from(players.values()),
    ball: ballState
  }));

  // Avisa aos outros jogadores
  broadcast({
    type: 'player_join',
    player: players.get(id)
  }, ws);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'state' && players.has(id)) {
      const p = players.get(id);
      p.charId = msg.charId || p.charId;
      p.x = Number(msg.x) || 0;
      p.y = Number(msg.y) || 0.12;
      p.z = Number(msg.z) || 0;
      p.ry = Number(msg.ry) || 0;
      p.moving = Boolean(msg.moving);
      p.running = Boolean(msg.running);

      broadcast({
        type: 'player_state',
        player: p
      }, ws);
    } else if (msg.type === 'ball_update') {
      ballState = {
        x: Number(msg.x) ?? ballState.x,
        y: Number(msg.y) ?? ballState.y,
        z: Number(msg.z) ?? ballState.z,
        vx: Number(msg.vx) || 0,
        vy: Number(msg.vy) || 0,
        vz: Number(msg.vz) || 0,
        goals: Number(msg.goals) ?? ballState.goals
      };
      broadcast({
        type: 'ball_sync',
        ball: ballState
      }, ws);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'player_leave', id });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Bangu City Multiplayer rodando na porta ${PORT}`);
});
