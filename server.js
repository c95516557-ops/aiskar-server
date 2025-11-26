// ======================================
//             SETUP
// ======================================

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static("public"));

// ======================================
//    ХРАНЕНИЕ СОСТОЯНИЯ СЕРВЕРА
// ======================================

let onlineUsers = {}; // { playerId: { username, socketId } }

let games = {}; // { gameId: { players: [], board: [...], turn } }

// ======================================
//           API ЭНДПОИНТЫ
// ======================================

// Создать игру
app.post("/api/create-game", (req, res) => {
  const { playerId } = req.body;

  if (!playerId) return res.json({ ok: false, error: "No playerId" });

  const gameId = "g_" + Math.random().toString(36).substring(2, 10);

  games[gameId] = {
    gameId,
    players: [playerId],
    board: ["", "", "", "", "", "", "", "", ""],
    turn: playerId
  };

  return res.json({ ok: true, gameId });
});

// Пригласить игрока
app.post("/api/invite-user", (req, res) => {
  const { playerId, username } = req.body;

  if (!playerId || !username)
    return res.json({ ok: false, error: "Bad request" });

  // найти онлайн игрока по username
  let entry = Object.entries(onlineUsers).find(
    (u) => u[1].username.toLowerCase() === username.toLowerCase()
  );

  if (!entry)
    return res.json({ ok: false, error: "Пользователь не найден онлайн" });

  const [friendId, friend] = entry;

  // создать игру
  const gameId = "g_" + Math.random().toString(36).substring(2, 10);

  games[gameId] = {
    gameId,
    players: [playerId, friendId],
    board: ["", "", "", "", "", "", "", "", ""],
    turn: playerId // приглашавший ходит первым
  };

  // отправить приглашение другу
  io.to(friend.socketId).emit("invite", {
    from: onlineUsers[playerId].username,
    gameId
  });

  return res.json({ ok: true });
});

// ======================================
//              SOCKET.IO
// ======================================

io.on("connection", (socket) => {
  const { playerId, username } = socket.handshake.query;

  if (playerId) {
    onlineUsers[playerId] = {
      socketId: socket.id,
      username: username || "player"
    };
  }

  console.log("Игрок подключился:", playerId, username);

  // -----------------------------
  // Игрок принимает приглашение
  // -----------------------------
  socket.on("invite-accepted", ({ gameId, invitedId }) => {
    const game = games[gameId];
    if (!game) return;

    // уведомить приглашавшего
    const inviter = game.players[0];

    io.to(onlineUsers[inviter].socketId).emit("invite-response", {
      accepted: true,
      game
    });

    // создать комнату
    socket.join(gameId);
    io.to(onlineUsers[inviter].socketId).socketsJoin(gameId);

    // уведомить приглашённого — запустить игру
    io.to(onlineUsers[invitedId].socketId).emit("start-after-accept", {
      game
    });
  });

  // -----------------------------
  // Игрок отклонил приглашение
  // -----------------------------
  socket.on("invite-rejected", ({ gameId }) => {
    const game = games[gameId];
    if (!game) return;

    const inviter = game.players[0];

    io.to(onlineUsers[inviter].socketId).emit("invite-response", {
      accepted: false
    });

    delete games[gameId];
  });

  // -----------------------------
  // Игрок делает ход
  // -----------------------------
  socket.on("make-move", ({ gameId, playerId, index }) => {
    const game = games[gameId];
    if (!game) return;

    // не его ход
    if (game.turn !== playerId) return;

    // клетка занята
    if (game.board[index]) return;

    const symbol = game.players[0] === playerId ? "X" : "O";
    game.board[index] = symbol;

    // смена хода
    game.turn = game.players.find((p) => p !== playerId);

    // обновить доску у всех игроков в комнате
    io.to(gameId).emit("update-board", {
      board: game.board,
      turn: game.turn
    });
  });

  // -----------------------------
  // Чат в игре
  // -----------------------------
  socket.on("chat", ({ gameId, playerId, msg }) => {
    io.to(gameId).emit("chat", { playerId, msg });
  });

  // -----------------------------
  // Отключение игрока
  // -----------------------------
  socket.on("disconnect", () => {
    console.log("Игрок отключился:", playerId);

    if (playerId) delete onlineUsers[playerId];
  });
});

// ======================================
//            START SERVER
// ======================================

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
