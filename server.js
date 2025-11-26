// --- server.js ---
// Рабочий backend для Telegram Mini App + Telegraf + Express + WebSocket

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { Telegraf } = require("telegraf");

require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ ERROR: BOT_TOKEN is missing in environment variables");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ----------------------------
//    МЕХАНИКА ИГРЫ
// ----------------------------
let games = {};  
// games[id] = {
//     p1: telegramId,
//     p2: telegramId,
//     board: ["", "", "", "", "", "", "", "", ""],
//     turn: "X",
//     chat: []
// }

// Генерация ID игры
function makeGameId() {
  return Math.random().toString(36).substring(2, 10);
}

// ----------------------------
//   API: Создать игру
// ----------------------------
app.post("/api/create-game", (req, res) => {
  const { playerId } = req.body;

  const gameId = makeGameId();

  games[gameId] = {
    p1: playerId,
    p2: null,
    board: ["", "", "", "", "", "", "", "", ""],
    turn: "X",
    chat: []
  };

  res.json({ gameId });
});

// ----------------------------
//   API: Подключиться к игре
// ----------------------------
app.post("/api/join-game", (req, res) => {
  const { playerId, gameId } = req.body;

  if (!games[gameId]) return res.json({ ok: false, error: "Game not found" });
  if (games[gameId].p2 !== null)
    return res.json({ ok: false, error: "Game already full" });

  games[gameId].p2 = playerId;

  res.json({ ok: true });
});

// ----------------------------
//   WebSocket: игра и чат
// ----------------------------
io.on("connection", (socket) => {
  socket.on("join", (gameId) => {
    socket.join(gameId);
  });

  socket.on("move", ({ gameId, index, symbol }) => {
    if (!games[gameId]) return;

    games[gameId].board[index] = symbol;
    games[gameId].turn = symbol === "X" ? "O" : "X";

    io.to(gameId).emit("update", games[gameId]);
  });

  socket.on("chat", ({ gameId, user, message }) => {
    if (!games[gameId]) return;

    const msg = { user, message };
    games[gameId].chat.push(msg);

    io.to(gameId).emit("chat", msg);
  });
});

// ----------------------------
//   Telegram Bot Logic
// ----------------------------
bot.start((ctx) => {
  ctx.reply("Добро пожаловать! Нажмите кнопку ниже чтобы открыть игру.", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть мини-приложение",
            web_app: {
              url: process.env.WEBAPP_URL
            }
          }
        ]
      ]
    }
  });
});

// Получение и обработка приглашений
bot.on("text", (ctx) => {
  if (ctx.message.text.startsWith("/invite ")) {
    const gameId = ctx.message.text.replace("/invite ", "").trim();

    ctx.reply(
      `Ваш друг пригласил вас в игру!\nНажмите ниже чтобы подключиться.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Войти в игру",
                web_app: { url: process.env.WEBAPP_URL + "?gameId=" + gameId }
              }
            ]
          ]
        }
      }
    );
  }
});

// Запуск бота
bot.launch();
console.log("Bot is running...");

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("Server running on port " + PORT)
);
