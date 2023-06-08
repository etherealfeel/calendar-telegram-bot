const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const botToken = '6200492149:AAGtCvaqUGiXQA2USvS4OHUDutulQL0jz6o';
const { OAuth2Client } = require('google-auth-library');
const request = require('request');

const formatDate = require('./utils');

const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const clientId =
  '961480583544-rcureqc6gcjo62kbg4r3glvhne2rlspq.apps.googleusercontent.com';
const clientSecret = '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';
const redirectUri = 'http://localhost:4000/oauth/callback';
let authorizationCode = '';

const express = require('express');
const app = express();

app.get('/oauth/callback', (req, res) => {
  authorizationCode = req.query.code;

  res.send('Authorization code received: ' + authorizationCode);
});

app.listen(4000, () => {
  console.log('Server started on port 4000');
});

const bot = new TelegramBot(botToken, { polling: true });


let client = new OAuth2Client({
  clientId:
    '961480583544-rcureqc6gcjo62kbg4r3glvhne2rlspq.apps.googleusercontent.com',
  clientSecret: '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',
  redirectUri: 'http://localhost:4000/oauth/callback',
});
let calendar = google.calendar({ version: 'v3', auth: client });

function getAuthUrl() {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar',
  });
  return authUrl;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const authUrl = getAuthUrl();

  bot.sendMessage(
    chatId,
    `Please authorize the bot by visiting the following link:\n${authUrl}\nAfter this step type /auth`,
  );
});

bot.onText(/\/auth/, (msg) => {
  const chatId = msg.chat.id;
  request.post(
    {
      url: tokenEndpoint,
      form: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: authorizationCode,
      },
    },
    (error, response, body) => {
      if (error) {
        console.error(
          'Error exchanging authorization code for access token:',
          error,
        );
        return;
      }

      if (response.statusCode === 200) {
        const tokenData = JSON.parse(body);
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        console.log('access token:', accessToken);
        console.log('refresh token:', refreshToken);
        client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        calendar = google.calendar({ version: 'v3', auth: client });
        bot.sendMessage(
          chatId,
          'Success 💚 You are now authorized to access all features.',
        );
      }
    },
  );
});

async function createEvent(title, dateTime) {
  const event = {
    summary: title,
    start: {
      dateTime: dateTime.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: dateTime.toISOString(),
      timeZone: 'America/New_York',
    },
  };

  return calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });
}

let eventTitle = '';
let eventDateTime = '';

bot.onText(/\/add/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Please enter the event title:');
  bot.onText(/(.+)/, (titleMsg, titleMatch) => {
    if (titleMsg.chat.id === chatId) {
      eventTitle = titleMatch[1];

      bot.sendMessage(
        chatId,
        'Please enter the event date and time (YYYY-MM-DD HH:mm):',
      );
      bot.onText(/(.+)/, (dateMsg, dateMatch) => {
        if (dateMsg.chat.id === chatId) {
          eventDateTime = new Date(dateMatch[1]);

          createEvent(eventTitle, eventDateTime)
            .then(() => {
              bot.sendMessage(chatId, 'Event created successfully!');
            })
            .catch((err) => {
              bot.sendMessage(
                chatId,
                'Error creating event. Please try again later.',
              );
            });
        }
      });
    }
  });
});

bot.onText(/\/delete (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const eventId = match[1]; // The ID of the event to delete

  deleteEvent(eventId)
    .then(() => {
      bot.sendMessage(chatId, 'Event deleted successfully!');
    })
    .catch((err) => {
      console.error('Error deleting event:', err);
      bot.sendMessage(chatId, 'Error deleting event. Please try again later.');
    });
});

async function deleteEvent(eventId) {
  return calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    console.log(events);
    let message = '📌 Upcoming events 📌\n';
    events.forEach((event, i) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      message += `${i + 1}. ${event.summary} 🕔 ${formatDate(
        start,
      )} - ${formatDate(end, true)}\n🆔: ${event.id}\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (err) {
    console.error('Error retrieving events:', err);
    bot.sendMessage(chatId, 'Error retrieving events. Please try again later.');
  }
});
