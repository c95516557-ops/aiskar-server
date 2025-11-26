// ===========================
//     Telegram MiniApp
// ===========================

const tg = window.Telegram?.WebApp;
tg?.expand();

let playerId =
  tg?.initDataUnsafe?.user?.id ||
  "user_" + Math.random().toString(36).substring(2);

let username =
  tg?.initDataUnsafe?.user?.username ||
  "user" + Math.floor(Math.random() * 9999);

// ===========================
//        SOCKET.IO
// ===========================
const socket = io({
  query: {
    playerId,
    username
  }
});

// ===========================
//        DOM ELEMENTS
// ===========================

const menu = document.getElementById("menu");
const inviteBlock = document.getElementById("invite-block");
const gameBlock = document.getElementById("game");

const board = document.getElementById("board");
const status = document.getElementById("status");

// приглашения
const invitePanel = document.getElementById("invite-panel");
const inviteText = document.getElementById("invite-text");
const acceptBtn = document.getElementById("accept-invite");
const rejectBtn = document.getElementById("reject-invite");

// чат
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

let gameId = null;

// ===========================
//        MENU BUTTONS
// ===========================

document.getElementById("play-ai").onclick = () => {
  startLocalAiGame();
};

document.getElementById("play-friend").onclick = () => {
  menu.classList.add("hidden");
  inviteBlock.classList.remove("hidden");
};

document.getElementById("invite-back").onclick = () => {
  inviteBlock.classList.add("hidden");
  menu.classList.remove("hidden");
};

document.getElementById("exit-menu").onclick = () => {
  location.reload();
};

// ===========================
//  GENERATE GAME LINK
// ===========================

document.getElementById("generate-link").onclick = async () => {
  let res = await fetch("/api/create-game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId })
  });

  let data = await res.json();

  if (!data.ok) return alert("Ошибка: " + data.error);

  gameId = data.gameId;

  const link = `${window.location.origin}?game=${gameId}`;
  const linkEl = document.getElementById("generated-link");

  linkEl.innerText = link;
  linkEl.classList.remove("hidden");
};

// ===========================
//   INVITE BY USERNAME
// ===========================

document.getElementById("send-invite").onclick = async () => {
  let friend = document.getElementById("friend-username").value.trim();
  if (!friend) return alert("Введите username");

  let res = await fetch("/api/invite-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, username: friend })
  });

  let data = await res.json();

  if (!data.ok) return alert("Ошибка: " + data.error);

  alert("Приглашение отправлено!");
};

// ===========================
//      START ONLINE GAME
// ===========================

function startGameOnline(game) {
  menu.classList.add("hidden");
  inviteBlock.classList.add("hidden");
  invitePanel.classList.add("hidden");
  gameBlock.classList.remove("hidden");

  gameId = game.gameId || gameId;

  board.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    let cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;

    cell.onclick = () => {
      socket.emit("make-move", {
        gameId,
        playerId,
        index: i
      });
    };

    board.appendChild(cell);
  }
}

// ===========================
//     GAME VS AI
// ===========================

function startLocalAiGame() {
  menu.classList.add("hidden");
  gameBlock.classList.remove("hidden");

  board.innerHTML = "";

  let cells = ["", "", "", "", "", "", "", "", ""];

  function render() {
    [...board.children].forEach((cell, idx) => {
      cell.textContent = cells[idx];
    });
  }

  for (let i = 0; i < 9; i++) {
    let cell = document.createElement("div");
    cell.className = "cell";

    cell.onclick = () => {
      if (cells[i]) return;
      cells[i] = "X";
      render();

      let ai = cells.indexOf("");
      if (ai !== -1) {
        cells[ai] = "O";
        render();
      }
    };

    board.appendChild(cell);
  }
}

// ===========================
//     SOCKET EVENTS
// ===========================

// Приглашение получено
socket.on("invite", ({ from, gameId: g }) => {
  gameId = g;
  inviteText.innerText = `Вас приглашает @${from}`;
  invitePanel.classList.remove("hidden");
});

// Принять приглашение
acceptBtn.onclick = () => {
  socket.emit("invite-accepted", {
    gameId,
    invitedId: playerId
  });
  invitePanel.classList.add("hidden");
};

// Отклонить приглашение
rejectBtn.onclick = () => {
  socket.emit("invite-rejected", {
    gameId,
    invitedId: playerId
  });
  invitePanel.classList.add("hidden");
};

// Приглашавший получает ответ
socket.on("invite-response", (data) => {
  if (data.accepted) {
    alert("Игрок принял приглашение!");
    startGameOnline(data.game);
  } else {
    alert("Игрок отклонил приглашение.");
  }
});

// Приглашённый заходит в игру
socket.on("start-after-accept", (data) => {
  startGameOnline(data.game);
});

// Обновить доску
socket.on("update-board", (data) => {
  [...board.children].forEach((cell, i) => {
    cell.textContent = data.board[i];
  });

  status.innerText = data.turn === playerId ? "Ваш ход" : "Ход соперника";
});

// ===========================
//          CHAT
// ===========================

chatSend.onclick = () => {
  let msg = chatInput.value.trim();
  if (!msg) return;

  socket.emit("chat", { gameId, playerId, msg });
  chatInput.value = "";
};

socket.on("chat", (data) => {
  chatBox.innerHTML += `<div><b>${data.playerId}:</b> ${data.msg}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
});
