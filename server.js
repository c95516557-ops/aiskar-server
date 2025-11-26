// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const shortid = require('shortid');
const TelegramBotHelper = require('./telegramBot'); // optional helper (uses
BOT_TOKEN)
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
cors: { origin: '*' }
  });
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// In-memory store (для простоты). Для production — Redis/DB.
const games = {}; // { [gameId]: { players: [username1, username2], board:
Array(9), turn: 'X'|'O', chat: [] } }
// API: создать игру
app.post('/api/create-game', (req, res) => {
const { creator } = req.body || {};
const gameId = shortid.generate();
games[gameId] = {
id: gameId,
players: [creator || null],
board: Array(9).fill(null),
turn: 'X',
status: 'waiting', // waiting | playing | finished
chat: []
};
res.json({ ok: true, gameId, url: `${BASE_URL}/?gameId=${gameId}` });
});
// API: invite via bot (optional)
app.post('/api/invite', async (req, res) => {
const { toUsername, fromUsername, gameId } = req.body || {};
if (!toUsername || !gameId) return res.status(400).json({ ok: false,
error: 'toUsername and gameId required' });
try {
const bot = TelegramBotHelper();
const message = `Вам предложена игра в Tic-Tac-Toe от @${fromUsername ||
'anonymous'}\nОткрыть: ${BASE_URL}/?gameId=${gameId}`;
// Попытка отправки по username — работает только если пользователь уже
писал боту
await bot.sendToUsername(toUsername, message);
res.json({ ok: true });
} catch (err) {
console.error('invite error', err.message || err);
res.status(500).json({ ok: false, error: err.message || String(err) });
}
});
// Serve index (frontend)
app.get('*', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Socket.IO: real-time game + chat
io.on('connection', (socket) => {
console.log('socket connected', socket.id);
socket.on('join-game', ({ gameId, username }) => {
if (!gameId) return socket.emit('error', 'gameId required');
socket.join(`game:${gameId}`);
const g = games[gameId];
if (!g) return socket.emit('error', 'game not found');
// добавляем игрока, если его ещё нет
if (!g.players.includes(username)) {
if (g.players.length < 2) g.players.push(username);
}
// синхронизируем состояние
io.to(`game:${gameId}`).emit('game-state', g);
});
socket.on('make-move', ({ gameId, index, symbol }) => {
const g = games[gameId];
if (!g) return socket.emit('error', 'game not found');
if (g.board[index] !== null) return; // invalid
g.board[index] = symbol;
// switch turn
g.turn = g.turn === 'X' ? 'O' : 'X';
// check win/draw
const winner = checkWinner(g.board);
if (winner) {
g.status = 'finished';
g.winner = winner;
} else if (g.board.every(cell => cell !== null)) {
g.status = 'finished';
g.winner = null; // draw
} else {
g.status = 'playing';
}
io.to(`game:${gameId}`).emit('game-state', g);
});
socket.on('send-chat', ({ gameId, username, text }) => {
const g = games[gameId];
if (!g) return;
const msg = { id: Date.now(), from: username, text };
g.chat.push(msg);
io.to(`game:${gameId}`).emit('chat-message', msg);
});
socket.on('disconnect', () => {
// опционально — можно пометить игрока как offline
});
});
function checkWinner(b) {
const lines = [
[0,1,2],[3,4,5],[6,7,8],
[0,3,6],[1,4,7],[2,5,8],
[0,4,8],[2,4,6]
];
for (const [a,bIdx,c] of lines) {
if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
}
return null;
}
server.listen(PORT, () => console.log(`Server listening on ${PORT};
BASE_URL=${BASE_URL}`));
