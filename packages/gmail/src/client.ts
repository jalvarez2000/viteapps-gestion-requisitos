import { google } from 'googleapis';
import { keys } from './keys';

export function getGmailClient() {
  const env = keys();

  const auth = new google.auth.OAuth2(
    env.GMAIL_CLIENT_ID,
    env.GMAIL_CLIENT_SECRET
  );

  auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });

  return google.gmail({ version: 'v1', auth });
}
