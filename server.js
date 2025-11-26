const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const Redis = require('redis');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });
const redis = Redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Статические файлы для Mini App (но основной на GitHub Pages)
app.use(express.static('public'));

// Игровые комнаты: { gameId: { board, players: {userId1: 'X', userId2: 'O'}, turn: 'X', chat: [] } }
const games = new Map();

// Socket.io: подключение игроков
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinGame', async (data) => {
    const { gameId, userId, username } = data;
    let game = games.get(gameId);

    if (!game) {
      // Создать новую игру
      game = { board: Array(9).fill(null), players: {}, turn: 'X', chat: [], creator: userId };
      games.set(gameId, game);
      game.players[userId] = 'X';
      socket.join(gameId);
      socket.emit('gameState', { board: game.board, turn: game.turn, mySymbol: 'X', chat: game.chat });
      await redis.set(`game:${gameId}`, JSON.stringify(game)); // Сохранение в Redis для персистентности
    } else if (Object.keys(game.players).length < 2) {
      // Присоединиться
      const symbol = Object.values(game.players)[0] === 'X' ? 'O' : 'X';
      game.players[userId] = symbol;
      socket.join(gameId);
      io.to(gameId).emit('playerJoined', { username, symbol });
      socket.emit('gameState', { board: game.board, turn: game.turn, mySymbol: symbol, chat: game.chat });
      
      // Уведомление создателю
      if (game.creator !== userId) {
        bot.sendMessage(game.creator, `🤝 @${username} присоединился к игре! Начинаем.`);
      }
    } else {
      socket.emit('error', 'Игра полная!');
    }
  });

  socket.on('makeMove', (data) => {
    const { gameId, pos } = data;
    const game = games.get(gameId);
    if (!game || game.board[pos] || game.turn !== game.players[socket.userId]) return;

    game.board[pos] = game.turn;
    game.turn = game.turn === 'X' ? 'O' : 'X';
    io.to(gameId).emit('moveMade', { pos, turn: game.turn, board: game.board });

    // Проверка победы (твоя функция checkWin из прошлого кода)
    if (checkWin(game.board, game.turn === 'X' ? 'O' : 'X')) {
      io.to(gameId).emit('gameOver', { winner: game.turn === 'X' ? 'O' : 'X' });
      games.delete(gameId);
    } else if (!game.board.includes(null)) {
      io.to(gameId).emit('gameOver', { winner: 'draw' });
      games.delete(gameId);
    }

    redis.set(`game:${gameId}`, JSON.stringify(game));
  });

  socket.on('sendChat', (data) => {
    const { gameId, msg, username } = data;
    const game = games.get(gameId);
    if (game) {
      const message = { username, msg, timestamp: Date.now() };
      game.chat.push(message);
      io.to(gameId).emit('chatMessage', message);
      redis.set(`game:${gameId}`, JSON.stringify(game));
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
});

// Telegram Bot: команды
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🎮 AiSKAR: Крестики-нолики!\nЖми кнопку в меню для Mini App.');
});

bot.onText(/\/invite (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const friendUsername = match[1].replace('@', '');
  const gameId = Math.random().toString(36).substr(2, 9);
  
  // Найти chatId друга
  try {
    const friendChat = await bot.getChat(`@${friendUsername}`);
    bot.sendMessage(friendChat.id, `🎯 @${msg.from.username} зовёт в крестики-нолики!\nЖми: t.me/${process.env.BOT_USERNAME}?start=game_${gameId}`);
    bot.sendMessage(chatId, `✅ Приглашение отправлено @${friendUsername}. Твоя игра: t.me/${process.env.BOT_USERNAME}?start=game_${gameId}`);
  } catch (e) {
    bot.sendMessage(chatId, '❌ Друг не найден. Проверь username.');
  }
});

// Функция проверки победы (из твоего прошлого кода)
function checkWin(board, player) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return wins.some(combo => combo.every(i => board[i] === player));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
