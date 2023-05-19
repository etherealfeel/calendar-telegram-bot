const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const botToken = '6200492149:AAGtCvaqUGiXQA2USvS4OHUDutulQL0jz6o';
require('dotenv').config();

//Create telegram bot
const bot = new TelegramBot(botToken, { polling: true });

// Provide the required configuration
const CREDENTIALS = JSON.parse(process.env.CREDENTIALS);
const credentialsJSON = require('./credentials.json');
const calendarId = process.env.CALENDAR_ID;

// Google calendar API settings
const SCOPES = 'https://www.googleapis.com/auth/calendar';
// const calendar = google.calendar({ version: 'v3', auth: CREDENTIALS });

const jwtClient = new google.auth.JWT(
  CREDENTIALS.client_email,
  null,
  CREDENTIALS.private_key,
  SCOPES
);

const calendar = google.calendar({
  version: "v3",
  auth: jwtClient,
});

const auth = new google.auth.GoogleAuth({
  keyFile: "./credentials.json",
  scopes: SCOPES,
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
    calendarId: calendarId,
    auth: jwtClient,
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

      bot.sendMessage(chatId, 'Please enter the event date and time (YYYY-MM-DD HH:mm):');
      bot.onText(/(.+)/, (dateMsg, dateMatch) => {
        if (dateMsg.chat.id === chatId) {
          eventDateTime = new Date(dateMatch[1]);

          createEvent(eventTitle, eventDateTime)
            .then(() => {
              bot.sendMessage(chatId, 'Event created successfully!');
            })
            .catch((err) => {
              console.error('Error creating event:', err);
              bot.sendMessage(chatId, 'Error creating event. Please try again later.');
            });
        }
      });
    }
  });
});

bot.onText(/\/events/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await calendar.events.list({
      calendarId: process.env.CALENDAR_ID,
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    let message = 'Upcoming events:\n';
    events.forEach((event) => {
      const start = event.start.dateTime || event.start.date;
      message += `${start} - ${event.summary}\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (err) {
    console.error('Error retrieving events:', err);
    bot.sendMessage(chatId, 'Error retrieving events. Please try again later.');
  }

});
