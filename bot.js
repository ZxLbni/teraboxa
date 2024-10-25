require('dotenv').config();

const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DUMP_CHANNEL_ID = process.env.DUMP_CHANNEL_ID;

const bot = new Telegraf(BOT_TOKEN);
console.log('Bot Connected');

const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir);
}

function formatProgressBar(filename, percentage, done, totalSize, status, speed, userMention, userId) {
    const barLength = 10;
    const filledLength = Math.floor(barLength * percentage / 100);
    const bar = '★'.repeat(filledLength) + '☆'.repeat(barLength - filledLength);

    function formatSize(size) {
        if (size < 1024) {
            return `${size} B`;
        } else if (size < 1024 ** 2) {
            return `${(size / 1024).toFixed(2)} KB`;
        } else if (size < 1024 ** 3) {
            return `${(size / 1024 ** 2).toFixed(2)} MB`;
        } else {
            return `${(size / 1024 ** 3).toFixed(2)} GB`;
        }
    }

    return `
┏ ғɪʟᴇɴᴀᴍᴇ: <b>${filename}</b>
┠ [${bar}] ${percentage.toFixed(2)}%
┠ ᴘʀᴏᴄᴇssᴇᴅ: <b>${formatSize(done)}</b> ᴏғ <b>${formatSize(totalSize)}</b>
┠ sᴛᴀᴛᴜs: <b>${status}</b>
┠ sᴘᴇᴇᴅ: <b>${formatSize(speed)}/s</b>
┖ ᴜsᴇʀ: ${userMention} | ɪᴅ: <code>${userId}</code>`;
}

async function downloadVideo(url, ctx, userMention, userId) {
    try {
        const response = await axios.get(`https://teraboxvideodownloader.nepcoderdevs.workers.dev/?url=${url}`);
        const data = response.data;

        if (!data.response || data.response.length === 0) {
            throw new Error('No response data found');
        }

        const resolutions = data.response[0].resolutions;
        const fastDownloadLink = resolutions['Fast Download'];
        const videoTitle = data.response[0].title.replace(/[<>:"/\\|?*]+/g, '');
        const videoPath = path.join(videosDir, `${videoTitle}.mp4`);

        const videoResponse = await axios({
            url: fastDownloadLink,
            method: 'GET',
            responseType: 'stream'
        });

        const totalLength = parseInt(videoResponse.headers['content-length']);
        let downloadedLength = 0;
        const startTime = Date.now();
        let lastPercentageUpdate = 0;

        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.on('data', chunk => {
            downloadedLength += chunk.length;
            writer.write(chunk);

            const elapsedTime = (Date.now() - startTime) / 1000;
            const percentage = (downloadedLength / totalLength) * 100;
            const speed = downloadedLength / elapsedTime;

            if (percentage - lastPercentageUpdate >= 7) {
                const progress = formatProgressBar(
                    videoTitle,
                    percentage,
                    downloadedLength,
                    totalLength,
                    'Downloading',
                    speed,
                    userMention,
                    userId
                );
                ctx.editMessageText(progress, { parse_mode: 'HTML' });
                lastPercentageUpdate = percentage;
            }
        });

        await new Promise((resolve, reject) => {
            videoResponse.data.on('end', () => {
                writer.end();
                resolve();
            });
            videoResponse.data.on('error', reject);
        });

        return { videoPath, videoTitle, totalLength };

    } catch (error) {
        throw new Error(`Download failed: ${error.message}`);
    }
}

bot.start((ctx) => {
    const user = ctx.from;
    const inlineKeyboard = {
        inline_keyboard: [[{ text: "ᴅᴇᴠᴇʟᴏᴘᴇʀ ⚡️", url: "tg://user?id=5809491943" }]] // Ensure this ID is correct
    };

    ctx.reply(
        `ᴡᴇʟᴄᴏᴍᴇ, <a href='tg://user?id=${user.id}'>${user.first_name}</a>.\n\n` +
        "🌟 ɪ ᴀᴍ ᴀ ᴛᴇʀᴀʙᴏx ᴅᴏᴡɴʟᴏᴀᴅᴇʀ ʙᴏᴛ.\n" +
        "sᴇɴᴅ ᴍᴇ ᴀɴʏ ᴛᴇʀᴀʙᴏx ʟɪɴᴋ ɪ ᴡɪʟʟ ᴅᴏᴡɴʟᴏᴀᴅ ᴡɪᴛʜɪɴ ғᴇᴡ sᴇᴄᴏɴᴅs\n" +
        "ᴀɴᴅ sᴇɴᴅ ɪᴛ ᴛᴏ ʏᴏᴜ ✨",
        { parse_mode: 'HTML', reply_markup: inlineKeyboard }
    );
});

bot.on('text', async (ctx) => {
    const videoUrl = ctx.message.text;
    const chatId = ctx.chat.id;
    const user = ctx.from;
    const userMention = `<a href='tg://user?id=${user.id}'>${user.first_name}</a>`;
    const userId = user.id;

    if (/http[s]?:\/\/.*tera/.test(videoUrl)) {
        const downloadMsg = await ctx.reply('ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ʏᴏᴜʀ ᴠɪᴅᴇᴏ...');

        try {
            const { videoPath, videoTitle, totalLength } = await downloadVideo(videoUrl, ctx, userMention, userId);
            const videoSizeMb = totalLength / (1024 * 1024);

            await ctx.telegram.sendVideo(DUMP_CHANNEL_ID, { source: videoPath }, {
                caption: `✨ ${videoTitle}\n📀 ${videoSizeMb.toFixed(2)} MB\n👤 ʟᴇᴇᴄʜᴇᴅ ʙʏ : ${userMention}\n📥 ᴜsᴇʀ ʟɪɴᴋ: tg://user?id=${userId}`,
                parse_mode: 'HTML'
            });

            await ctx.replyWithVideo({ source: videoPath }, {
                caption: `✨ ${videoTitle}\n👤 ʟᴇᴇᴄʜᴇᴅ ʙʏ : ${userMention}\n📥 ᴜsᴇʀ ʟɪɴᴋ: tg://user?id=${userId}`,
                parse_mode: 'HTML'
            });

            await ctx.replyWithSticker("CAACAgIAAxkBAAEZdwRmJhCNfFRnXwR_lVKU1L9F3qzbtAAC4gUAAj-VzApzZV-v3phk4DQE");
            await ctx.deleteMessage(downloadMsg.message_id);
            await ctx.deleteMessage(ctx.message.message_id);

            fs.unlinkSync(videoPath);
        } catch (error) {
            await ctx.editMessageText(`Download failed: ${error.message}`);
        }
    } else {
        await ctx.reply('ᴘʟᴇᴀsᴇ sᴇɴᴅ ᴀ ᴠᴀʟɪᴅ ᴛᴇʀᴀʙᴏx ʟɪɴᴋ.');
    }
});

const app = express();
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch();