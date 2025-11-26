const socket = io();
let tg = window.Telegram?.WebApp;

const menu = document.getElementById("menu");
const inviteBlock = document.getElementById("invite-block");
const gameBlock = document.getElementById("game");
const board = document.getElementById("board");
const status = document.getElementById("status");

let playerId = tg?.initDataUnsafe?.user?.id || "user" + Math.random();
let gameId = null;

// ======================== МЕНЮ ========================

document.getElementById("play-ai").onclick = () => {
    startLocalAiGame();
};

document.getElementById("play-friend").onclick = () => {
    menu.classList.add("hidden");
    inviteBlock.classList.remove("hidden");
};

// кнопка Назад
document.getElementById("invite-back").onclick = () => {
    inviteBlock.classList.add("hidden");
    menu.classList.remove("hidden");
};

// =================== СОЗДАНИЕ ССЫЛКИ ПРИГЛАШЕНИЯ ===================

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
    document.getElementById("generated-link").innerText = link;
    document.getElementById("generated-link").classList.remove("hidden");
};

// =================== ИГРА С ДРУГОМ ===================

document.getElementById("send-invite").onclick = async () => {
    let username = document.getElementById("friend-username").value.trim();
    if (!username) return;

    await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, username })
    });

    alert("Приглашение отправлено");
};

function startGameOnline(game) {
    menu.classList.add("hidden");
    inviteBlock.classList.add("hidden");
    gameBlock.classList.remove("hidden");

    board.innerHTML = "";

    for (let i = 0; i < 9; i++) {
        let cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.idx = i;

        cell.onclick = () => {
            socket.emit("make-move", { gameId, playerId, index: i });
        };

        board.appendChild(cell);
    }
}

// ======================== ИГРА ПРОТИВ AI ========================

function startLocalAiGame() {
    gameId = "ai";
    menu.classList.add("hidden");
    gameBlock.classList.remove("hidden");

    board.innerHTML = "";

    let cells = ["", "", "", "", "", "", "", "", ""];

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

    function render() {
        [...board.children].forEach((c, i) => c.textContent = cells[i]);
    }
}

// ======================== SOCKET.IO ========================

socket.on("game-start", (data) => {
    gameId = data.gameId;
    startGameOnline(data.game);
});

socket.on("update-board", (data) => {
    [...board.children].forEach((c, i) => {
        c.textContent = data.board[i];
    });
    status.textContent = data.turn === playerId ? "Ваш ход" : "Ход соперника";
});

// ======================== ЧАТ ========================

document.getElementById("chat-send").onclick = () => {
    let msg = document.getElementById("chat-input").value;
    if (!msg) return;

    socket.emit("chat", { gameId, playerId, msg });
    document.getElementById("chat-input").value = "";
};

socket.on("chat", (data) => {
    let box = document.getElementById("chat-box");
    box.innerHTML += `<div><b>${data.playerId}:</b> ${data.msg}</div>`;
    box.scrollTop = box.scrollHeight;
});

// ======================== ВЫЙТИ ========================

document.getElementById("exit-menu").onclick = () => location.reload();
