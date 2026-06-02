const { google } = require('googleapis');

function getGoogleAuth() {

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

}

function generateAuthUrl(chatId) {
  const oauth2Client = getGoogleAuth();
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: chatId.toString()
  });
}

async function exchangeCodeForTokens(code) {
  const oauth2Client = getGoogleAuth();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

module.exports = {
  getGoogleAuth,
  generateAuthUrl,
  exchangeCodeForTokens
};