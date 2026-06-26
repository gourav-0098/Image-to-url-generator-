import { google } from 'googleapis';
import dotenv from 'dotenv';

// Graceful: dotenv silently does nothing if .env is missing (Vercel injects vars directly)
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

export const drive = google.drive({ version: 'v3', auth: oauth2Client });
export { oauth2Client };

if (process.env.NODE_ENV !== 'production') {
  console.log('[Drive] OAuth2 client initialized.');
}
