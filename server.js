// server.js


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


server.listen(PORT, () => console.log(`Server listening on ${PORT}; BASE_URL=${BASE_URL}`));
