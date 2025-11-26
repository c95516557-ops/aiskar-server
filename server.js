// --- server.js ---
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { Telegraf } = require("telegraf");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

if (!BOT_TOKEN) {
  console.error("❌ ERROR: BOT_TOKEN missing!");
  process.exit(1);
}

if (!WEBAPP_URL) {
  console.error("❌ ERROR: WEBAPP_URL missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== GAME SYSTEM =====

let games = {}; // game storage

function createId() {
  return Math.random().toString(36).substring(2, 10);
}

app.post("/api/create-game", (req, res) => {
  const { playerId } = req.body;

  if (!playerId)
    return res.status(400).json({ ok: false, error: "playerId missing" });

  const gameId = createId();

  games[gameId] = {
    p1: playerId,
    p2: null,
    board: ["", "", "", "", "", "", "", "", ""],
    turn: "X",
    chat: []
  };

  res.json({ ok: true, gameId });
});

app.post("/api/join-game", (req, res) => {
  const { playerId, gameId } = req.body;

  if (!games[gameId])
    return res.json({ ok: false, error: "game not found" });

  if (games[gameId].p2)
    return res.json({ ok: false, error: "game full" });

  games[gameId].p2 = playerId;

  res.json({ ok: true });
});

// ===== SOCKET IO =====

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

// ===== BOT =====

bot.start((ctx) => {
  ctx.reply("Добро пожаловать!", {
    reply_markup: {
      inline_keyboard: [[
        { text: "Открыть игру", web_app: { url: WEBAPP_URL } }
      ]]
    }
  });
});

bot.on("text", (ctx) => {
  if (ctx.message.text.startsWith("/invite ")) {
    const gameId = ctx.message.text.replace("/invite ", "");

    ctx.reply(
      "Вас пригласили в игру!", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Присоединиться", web_app: { url: WEBAPP_URL + "?gameId=" + gameId } }
          ]]
        }
      }
    );
  }
});

bot.launch();

// ===== START =====

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on " + PORT));
