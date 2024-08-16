// Importing necessary modules
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const ping = require('ping');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

const PRAYER_API_URL = 'http://api.aladhan.com/v1/timingsByCity?city=Kangar&country=Malaysia'; // URL for prayer times API
const EIGHTBALL_API_URL = 'https://api.popcat.xyz/8ball'; // New URL for 8-ball API

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to log in.');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Function to handle Instagram content
async function sendInstagramContent(message, link) {
    try {
        const response = await axios.get(link);
        const $ = cheerio.load(response.data);

        // Extract video or image URL
        const videoUrl = $('meta[property="og:video"]').attr('content');
        const imageUrl = $('meta[property="og:image"]').attr('content');

        if (videoUrl) {
            // It's a video
            const videoMedia = await MessageMedia.fromUrl(videoUrl);
            await message.reply(videoMedia);
        } else if (imageUrl) {
            // It's an image
            const imageMedia = await MessageMedia.fromUrl(imageUrl);
            await message.reply(imageMedia);
        } else {
            await message.reply('Could not find media content at the provided link :(');
        }
    } catch (error) {
        console.error('Error fetching Instagram content:', error);
        await message.reply('Error fetching Instagram content :(');
    }
}

// Function to handle meme images
async function sendMemeImage(message) {
    try {
        const response = await axios.get('https://meme-api.com/gimme');
        const meme = response.data;

        console.log('Meme Image URL:', meme.url);  // Log the URL

        if (meme.url.endsWith('.jpg') || meme.url.endsWith('.png') || meme.url.endsWith('.gif')) {
            const memeMedia = await MessageMedia.fromUrl(meme.url);
            await message.reply(memeMedia);
        } else {
            throw new Error('Unsupported image format.');
        }
    } catch (error) {
        console.error('Error fetching meme image:', error);
        await message.reply('Could not fetch meme image :(');
    }
}

// Function to handle quiz
const activeQuizzes = {}; // To store ongoing quizzes with user ids

async function sendQuiz(message) {
    try {
        const response = await axios.get('https://opentdb.com/api.php', {
            params: {
                amount: 1,
                type: 'multiple'
            }
        });

        const quiz = response.data.results[0];
        const question = quiz.question;
        const correctAnswer = quiz.correct_answer;
        const incorrectAnswers = quiz.incorrect_answers;
        const allAnswers = [correctAnswer, ...incorrectAnswers].sort(() => Math.random() - 0.5);

        // Store the quiz for later validation
        activeQuizzes[message.from] = {
            question: question,
            correctAnswer: correctAnswer,
            allAnswers: allAnswers
        };

        let quizText = `Quiz Time!\n\n${question}\n\n`;
        allAnswers.forEach((answer, index) => {
            quizText += `${index + 1}. ${answer}\n`;
        });

        await message.reply(quizText);
        await message.reply('Reply with the number of your answer.');
    } catch (error) {
        console.error('Error fetching quiz question:', error);
        await message.reply('Could not fetch quiz question :(');
    }
}

async function handleQuizResponse(message) {
    const userAnswerIndex = parseInt(message.body.trim(), 10) - 1;
    const userQuiz = activeQuizzes[message.from];

    if (userQuiz) {
        const correctAnswerIndex = userQuiz.allAnswers.indexOf(userQuiz.correctAnswer);
        let responseMessage = '';

        if (userAnswerIndex === correctAnswerIndex) {
            responseMessage = 'Correct! :D';
        } else {
            responseMessage = `Incorrect. The correct answer is: ${userQuiz.correctAnswer}`;
        }

        await message.reply(responseMessage);

        // Clean up the quiz data
        delete activeQuizzes[message.from];
    }
}

async function sendMenu(message) {
    const menuText = `
*Bot Commands:*

• *pls menu* - Show this menu
• *pls ai <query>* - Ask the AI chatbot a question
• *pls meme* - Get a random meme image
• *pls joke* - Get a random joke
• *pls quiz* - Start a quiz
• *pls tl <language> <text>* - Translate text to specified language
• *pls pray* - Get prayer times for Kangar, Malaysia
• *pls ping* - Get bot connection info
• *pls 8ball <text>* - Ask the 8-ball a question

*Enjoy using the bot!*
`;

    await message.reply(menuText);
}

async function pingBot(message) {
    try {
        const res = await ping.promise.probe('google.com');
        const pingInfo = `
*Pong!*

*Ping Information:*

- *Host:* google.com
- *Latency:* ${res.time} ms
- *Alive:* ${res.alive ? 'Yes' : 'No'}

*Bot is connected and running smoothly :D*
`;

        await message.reply(pingInfo);
    } catch (error) {
        console.error('Error fetching ping information:', error);
        await message.reply('Could not fetch ping information :(');
    }
}

// Function to handle prayer times
async function sendPrayerTimes(message) {
    try {
        const response = await axios.get(PRAYER_API_URL);
        const prayerTimes = response.data.data.timings;

        const prayerText = `
*Prayer Times for Kangar, Malaysia:*

- *Fajr:* ${prayerTimes.Fajr}
- *Sunrise:* ${prayerTimes.Sunrise}
- *Dhuhr:* ${prayerTimes.Dhuhr}
- *Asr:* ${prayerTimes.Asr}
- *Maghrib:* ${prayerTimes.Maghrib}
- *Isha:* ${prayerTimes.Isha}

*Note: Times are approximate and may vary slightly.*
`;

        await message.reply(prayerText);
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        await message.reply('Could not fetch prayer times :(');
    }
}

// Function to handle AI queries
async function handleAIRequest(message, query) {
    try {
        if (!query) throw 'uhm.. what do you want to say?';

        const prompt = encodeURIComponent(query);
        
        // Try to get the sender's ID
        const userid = message.from || "default";
        let apiurl = `https://api.guruapi.tech/ai/gpt4?username=${userid}&query=hii${prompt}`;

        const result = await axios.get(apiurl);
        const response = result.data;
        
        if (!response.msg) throw 'No result found';

        const replyText = response.msg;
        await message.reply(replyText);
    } catch (error) {
        console.error('Error handling AI request:', error);
        await message.reply('Oops! Something went wrong. We are trying hard to fix it ASAP.');
    }
}

// Function to handle translation
async function translateText(message, language, text) {
    try {
        const response = await axios.get('https://api.popcat.xyz/translate', {
            params: {
                to: language,
                text: text
            }
        });

        const { translated } = response.data;

        if (!translated) {
            await message.reply('*Error*');
        } else {
            await message.reply(translated);
        }
    } catch (error) {
        console.error('Error fetching translation:', error);
        await message.reply('Could not fetch translation :(');
    }
}

// Function to handle 8-ball queries
async function handle8BallRequest(message, question) {
    try {
        if (!question) throw 'You need to ask a question!';

        const response = await axios.get(EIGHTBALL_API_URL);
        const answer = response.data.answer;

        await message.reply(answer);
    } catch (error) {
        console.error('Error fetching 8-ball response:', error);
        await message.reply('Could not fetch 8-ball response :(');
    }
}

// Main message handler
client.on('message_create', async (message) => {
    if (message.fromMe || (await message.getChat()).isGroup) {
        if (message.body.startsWith('pls ig ')) {
            const link = message.body.slice(7).trim();
            await sendInstagramContent(message, link);
        } else if (message.body.startsWith('pls ai ')) {
            const query = message.body.slice(7).trim();
            await handleAIRequest(message, query);
        } else if (message.body === 'pls meme') {
            await sendMemeImage(message);
        } else if (message.body === 'pls joke') {
            try {
                const joke = await axios.get('https://official-joke-api.appspot.com/jokes/random');
                const jokeText = `${joke.data.setup}\n\n${joke.data.punchline}`;
                await message.reply(jokeText);
            } catch (error) {
                console.error('Error fetching joke:', error);
                await message.reply('Error fetching joke.');
            }
        } else if (message.body === 'pls quiz') {
            await sendQuiz(message);
        } else if (message.body.match(/^\d+$/) && activeQuizzes[message.from]) {
            await handleQuizResponse(message);
        } else if (message.body === 'pls menu') {
            await sendMenu(message);
        } else if (message.body === 'pls ping') {
            await pingBot(message);
        } else if (message.body === 'pls pray') {
            await sendPrayerTimes(message);
        } else if (message.body.startsWith('pls tl ')) {
            const parts = message.body.slice(7).trim().split(' ', 2);
            const language = parts[0];
            const text = parts[1];
            await translateText(message, language, text);
        } else if (message.body.startsWith('pls 8ball ')) {
            const question = message.body.slice(10).trim();
            await handle8BallRequest(message, question);
        }
    }
});

client.initialize();
