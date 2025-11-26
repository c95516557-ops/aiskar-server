// telegramBot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');


let botInstance = null;


module.exports = function getBot() {
if (botInstance) return botInstance;
const token = process.env.BOT_TOKEN;
if (!token) {
// Если токена нет — вернём "заглушку" с методами, которые падают
return {
sendToUsername: async (username, text) => { throw new Error('BOT_TOKEN not configured'); }
};
}


const bot = new TelegramBot(token, { polling: false });


bot.sendToUsername = async (username, text) => {
// отправка по username работает ТОЛЬКО если пользователь ранее запускал бота и бот имеет contact
// иначе Telegram возвращает ошибку. Попробуем найти chatId по username командой getChat
try {
const chat = await bot.getChat(`@${username}`);
if (!chat || !chat.id) throw new Error('no chat id');
await bot.sendMessage(chat.id, text, { disable_web_page_preview: true });
return true;
} catch (err) {
throw new Error('Не удалось отправить приглашение через бота. Возможно, пользователь ещё не запускал бота.');
}
};


botInstance = bot;
return botInstance;
};
