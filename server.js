const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

// БЕРЁМ ПЕРЕМЕННЫЕ ПРЯМО ИЗ process.env (Render даёт их автоматически)
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'aiskar_game_bot';

if (!BOT_TOKEN) {
    console.error('ОШИБКА: Добавь BOT_TOKEN в Environment Variables на Render!');
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Хранилище игр (в памяти — для тестов достаточно)
const games = new Map();

// === Socket.io логика ===
io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('joinGame', ({ gameId, userId, username = 'Игрок' }) => {
        let game = games.get(gameId);

        if (!game) {
            // Создаём новую игру
            game = {
                board: Array(9).fill(null),
                players: { [userId]: 'X' },
                turn: 'X',
                chat: [],
                creator: userId
            };
            games.set(gameId, game);
            socket.join(gameId);
            socket.emit('gameState', {
                board: game.board,
                turn: game.turn,
                mySymbol: 'X',
                chat: game.chat
            });
            console.log(`Создана игра ${gameId} — X: ${username}`);
        } else if (Object.keys(game.players).length === 1) {
            // Второй игрок
            const symbol = Object.values(game.players)[0] === 'X' ? 'O' : 'X';
            game.players[userId] = symbol;
            socket.join(gameId);
            io.to(gameId).emit('playerJoined', { username, symbol });
            socket.emit('gameState', {
                board: game.board,
                turn: game.turn,
                mySymbol: symbol,
                chat: game.chat
            });
            io.to(gameId).emit('status', 'Игра началась! Ходит X');
            console.log(`Присоединился O: ${username}`);
        } else {
            socket.emit('error', 'Игра уже полная');
        }
    });

    socket.on('makeMove', ({ gameId, pos }) => {
        const game = games.get(gameId);
        if (!game || game.board[pos] !== null || game.turn !== game.players[socket.handshake.query.userId]) return;

        game.board[pos] = game.turn;
        game.turn = game.turn === 'X' ? 'O' : 'X';

        io.to(gameId).emit('moveMade', { pos, symbol: game.board[pos], board: game.board, turn: game.turn });

        // Проверка победы
        if (checkWin(game.board, game.board[pos])) {
            io.to(gameId).emit('gameOver', { winner: game.board[pos] });
            games.delete(gameId);
        } else if (!game.board.includes(null)) {
            io.to(gameId).emit('gameOver', { winner: 'draw' });
            games.delete(gameId);
        }
    });

    socket.on('sendChat', ({ gameId, msg, username }) => {
        const game = games.get(gameId);
        if (game) {
            const message = { username: username || 'Аноним', msg };
            game.chat.push(message);
            io.to(gameId).emit('chatMessage', message);
        }
    });
});

// === Проверка победы ===
function checkWin(board, symbol) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(combo => combo.every(i => board[i] === symbol));
}

// === Бот: приглашения ===
bot.onText(/\/start game_(.+)/, (msg, match) => {
    const gameId = match[1];
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    bot.sendMessage(userId, `Подключаемся к игре ${gameId}...`);
    // Открываем Web App с параметром
    const webAppUrl = `https://твой-логин.github.io/aiskar-miniapp/?game=${gameId}`;
    bot.sendMessage(userId, 'Играй против друга!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Открыть игру', web_app: { url: webAppUrl } }]]
        }
    });
});

bot.onText(/\/invite (.+)/, (msg, match) => {
    const friend = match[1].replace('@', '');
    const gameId = Math.random().toString(36).substr(2, 9);
    bot.sendMessage(msg.chat.id, `Пригласи друга: t.me/${BOT_USERNAME}?start=game_${gameId}`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`AiSKAR сервер запущен на порту ${PORT}`);
    console.log(`Бот: @${BOT_USERNAME}`);
});
