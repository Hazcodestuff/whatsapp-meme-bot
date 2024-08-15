const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY'; // Replace with your YouTube Data API key
const YOUTUBE_PLAYLIST_ID = 'YOUR_YOUTUBE_PLAYLIST_ID'; // Replace with the playlist ID containing Shorts

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to log in.');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Function to handle meme images
async function sendMemeImage(message) {
    try {
        const response = await axios.get('https://meme-api.com/gimme');
        const meme = response.data;

        console.log('Meme Image URL:', meme.url);  // Log the URL

        if (meme.url.endsWith('.jpg') || meme.url.endsWith('.png') || meme.url.endsWith('.gif')) {
            const memeMedia = await MessageMedia.fromUrl(meme.url);
            await client.sendMessage(message.from, memeMedia);
        } else {
            throw new Error('Unsupported image format.');
        }
    } catch (error) {
        console.error('Error fetching meme image:', error);
        await client.sendMessage(message.from, 'Could not fetch meme image :(');
    }
}

// Function to handle meme videos
async function sendMemeVideo(message) {
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems`, {
            params: {
                part: 'snippet',
                playlistId: YOUTUBE_PLAYLIST_ID,
                maxResults: 50,
                key: YOUTUBE_API_KEY
            }
        });

        const videos = response.data.items;

        if (videos.length === 0) {
            throw new Error('No videos found in the playlist.');
        }

        const randomVideo = videos[Math.floor(Math.random() * videos.length)];
        const videoId = randomVideo.snippet.resourceId.videoId;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        console.log('YouTube Short URL:', videoUrl);  // Log the URL

        const videoStream = ytdl(videoUrl, { quality: 'lowestvideo' });
        const videoPath = path.join(__dirname, 'video.mp4');
        const writeStream = fs.createWriteStream(videoPath);
        videoStream.pipe(writeStream);

        writeStream.on('finish', async () => {
            console.log('Video downloaded successfully.');

            const memeMedia = MessageMedia.fromFilePath(videoPath);
            await client.sendMessage(message.from, memeMedia);

            fs.unlinkSync(videoPath);
        });
    } catch (error) {
        console.error('Error fetching or sending meme video:', error);
        await client.sendMessage(message.from, 'Could not fetch or send meme video :(');
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

        await client.sendMessage(message.from, quizText);
        await client.sendMessage(message.from, 'Reply with the number of your answer.');
    } catch (error) {
        console.error('Error fetching quiz question:', error);
        await client.sendMessage(message.from, 'Could not fetch quiz question :(');
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

        await client.sendMessage(message.from, responseMessage);

        // Clean up the quiz data
        delete activeQuizzes[message.from];
    }
}

// Replace with your OpenAI API key
const OPENAI_API_KEY = 'OPEN_AI_KEY';

async function getOpenAIResponse(prompt) {
    try {
        const response = await axios.post('https://api.openai.com/v1/completions', {
            model: 'text-davinci-003', // or any other model you prefer
            prompt: prompt,
            max_tokens: 100
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error('Error fetching OpenAI response:', error);
        return 'Sorry, there was an error processing your request.';
    }
}

async function handleAIRequest(message) {
    const messageText = String(message.body);  // Convert message body to string
    if (messageText.startsWith('pls ai ')) {
        const query = messageText.substring(7).trim();
        const aiResponse = await getOpenAIResponse(query);
        await client.sendMessage(message.from, aiResponse);
    }
}

client.on('message_create', async message => {
    if (message.body === 'pls meme') {
        await sendMemeImage(message);
    } else if (message.body === 'pls memevid') {
        await sendMemeVideo(message);
    } else if (message.body === 'pls joke') {
        try {
            const joke = await axios.get('https://official-joke-api.appspot.com/jokes/random');
            const jokeText = `${joke.data.setup}\n\n${joke.data.punchline}`;
            await client.sendMessage(message.from, jokeText);
        } catch (error) {
            console.error('Error fetching joke:', error);
            await client.sendMessage(message.from, 'Error fetching joke.');
        }
    } else if (message.body === 'pls quiz') {
        await sendQuiz(message);
    } else if (message.body.match(/^\d+$/) && activeQuizzes[message.from]) {
        await handleQuizResponse(message);
    } else {
        await handleAIRequest(message);
    }
});

client.initialize();
