require('dotenv').config();
const messages = require('./messages.json');
const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const { OAuth2Client } = require('google-auth-library');
const request = require('request');
const schedule = require('node-schedule');
const formatDate = require('./utils');
const express = require('express');
const app = express();
const axios = require('axios');
const tokenEndpoint = process.env.TOKEN_ENDPOINT;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const calendarRouter = require('./db/routes/calendar.routes');

app.get('/oauth/callback', (req, res) => {
  authorizationCode = req.query.code;
  res.send('Код авторизації отримано(Authorization code received)!');
});

app.use(express.json());
app.use('/calendar', calendarRouter);

app.listen(4000, () => {
  console.log('Server started on port 4000');
});

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let client = new OAuth2Client({
  clientId,
  clientSecret,
  redirectUri,
});
let calendar = null;
let authorizationCode = '';

const getAuthUrl = () => {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar',
  });
  return authUrl;
};

const sendNotification = (chatId, message) => {
  bot.sendMessage(chatId, message);
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const authUrl = getAuthUrl();

  bot.sendMessage(
    chatId,
    `Авторизуйтесь, перейшовши за наступним посиланням:\n${authUrl}\nПісля надання доступу введіть /auth`,
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
        client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        calendar = google.calendar({ version: 'v3', auth: client });
        bot.sendMessage(chatId, messages.MSG_AUTHED);
        bot.sendMessage(chatId, messages.MSG_SUB_SUCC);
      }
    },
  );
  axios
    .get('http://localhost:4000/calendar/timer')
    .then((response) => {
      const timerMinutes = response.data;
      bot.sendMessage(
        chatId,
        `\nВи отримуєте оповіщення про події за ${timerMinutes} хвилин до них. \nНалаштування таймера - /updatereminder minutes`,
      );
    })
    .catch((error) => {
      console.error('Error:', error);
    });
});

bot.onText(/\/updatereminder (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const timerMinutes = match[1];
  if (timerMinutes > 1440) {
    bot.sendMessage(chatId, 'Максимально дозволений таймер - 24 години.');
    return;
  }

  const data = {
    timer: timerMinutes,
    descr: 'timerUpdatedViaBot',
  };

  axios
    .put('http://localhost:4000/calendar/timer', data)
    .then((response) => {
      bot.sendMessage(
        chatId,
        `Оновлений таймер для оповіщень: ${data.timer} хвилин ✅`,
      );
    })
    .catch((error) => {
      bot.sendMessage(chatId, messages.MSG_UPDATETIMER_SUCC);
      console.error('Error:', error);
    });
});

const createEvent = async (title, startDateTime, endDateTime) => {
  const event = {
    summary: title,
    start: {
      dateTime: new Date(startDateTime),
    },
    end: {
      dateTime: new Date(endDateTime),
    },
  };

  return calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });
};

bot.onText(/\/create (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const eventDetails = match[1].split(',');
  const [summary, startDateTime, endDateTime] = eventDetails;

  createEvent(summary, startDateTime, endDateTime)
    .then(() => {
      bot.sendMessage(chatId, messages.MSG_CREATE_SUCC);
    })
    .catch((err) => {
      bot.sendMessage(chatId, messages.MSG_CREATE_ERR);
    });
});

bot.onText(/\/delete (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const eventId = match[1];

  deleteEvent(eventId)
    .then(() => {
      bot.sendMessage(chatId, messages.MSG_DELETE_SUCC);
    })
    .catch((err) => {
      console.error('Error deleting event:', err);
      bot.sendMessage(chatId, messages.MSG_DELETE_ERR);
    });
});

const deleteEvent = async (eventId) => {
  return calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
};

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
    let message = events.length
      ? messages.MSG_EVENTS_HEADER
      : messages.MSG_NO_EVENTS;
    events.forEach((event, i) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      message += `${i + 1}. ${event.summary} ☑ ${formatDate(
        start,
      )} - ${formatDate(end)}\n🆔: ${event.id}\n`;

      const eventTime = new Date(event.start.dateTime);
      axios
        .get('http://localhost:4000/calendar/timer')
        .then((response) => {
          const timerMinutes = response.data;
          const notificationTime = new Date(
            eventTime.getTime() - timerMinutes * 60000,
          );

          schedule.scheduleJob(notificationTime, function () {
            const notificationMessage = `Нагадування: подія "${event.summary}" почнеться за ${timerMinutes} хвилин❕`;
            sendNotification(chatId, notificationMessage);
          });
        })
        .catch((error) => {
          console.error('Error:', error);
        });
    });

    bot.sendMessage(chatId, message);
  } catch (err) {
    console.error('Error retrieving events:', err);
    bot.sendMessage(chatId, messages.MSG_EVENTS_ERR);
  }
});

bot.onText(/\/deleteall/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    if (!events.length) {
      bot.sendMessage(chatId, messages.MSG_NO_EVENTS);
      return;
    }
    events.forEach((event) => {
      deleteEvent(event.id);
    });

    bot.sendMessage(chatId, messages.MSG_DELETEALL_SUCC);
  } catch (err) {
    console.error('Error retrieving events:', err);
    bot.sendMessage(chatId, messages.MSG_DELETE_ERR);
  }
});
