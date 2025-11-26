const tg = window.Telegram.WebApp;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const gameEl = document.getElementById("game");

const playFriendBtn = document.getElementById("play-friend");
const exitBtn = document.getElementById("exit");

const msgInput = document.getElementById("msgInput");
const sendMsgBtn = document.getElementById("sendMsg");
const messagesEl = document.getElementById("messages");

let gameId = null;
let playerId = tg.initDataUnsafe?.user?.id || Math.random().toString(36);
let symbol = "X";

const socket = io();

function drawBoard(board) {
  boardEl.innerHTML = "";
  board.forEach((cell, i) => {
    const div = document.createElement("div");
    div.className = "cell";
    div.textContent = cell;
    div.onclick = () => {
      if (cell === "" && symbol === gamesTurn) {
        socket.emit("move", { gameId, index: i, symbol });
      }
    };
    boardEl.appendChild(div);
  });
}

let gamesTurn = "X";

socket.on("update", (game) => {
  gamesTurn = game.turn;
  drawBoard(game.board);
  statusEl.textContent = "Ход: " + gamesTurn;
});

socket.on("chat", (msg) => {
  messagesEl.innerHTML += `<div><b>${msg.user}:</b> ${msg.message}</div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// SEND CHAT MESSAGE
sendMsgBtn.onclick = () => {
  const txt = msgInput.value;
  if (!txt) return;

  socket.emit("chat", {
    gameId,
    user: tg.initDataUnsafe.user.first_name,
    message: txt
  });

  msgInput.value = "";
};

// CREATE GAME
playFriendBtn.onclick = async () => {
  const res = await fetch("/api/create-game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId })
  });

  const data = await res.json();

  if (!data.ok) return alert("Ошибка: " + data.error);

  gameId = data.gameId;

  tg.sendData("/invite " + gameId);

  startGame();
};

function startGame() {
  gameEl.classList.remove("hidden");
  socket.emit("join", gameId);
}

// exit to menu
exitBtn.onclick = () => {
  window.location.reload();
};
