import axios from 'axios';
import { OAuthUser } from '../src/types';

// Active in-memory session store
export const authenticatedSessions: Record<string, OAuthUser> = {
  'demo-borrower-session': {
    id: 'user_aarti_patel',
    email: 'nilavra.s2007@gmail.com',
    name: 'Aarti Patel (Farmer / Borrower)',
    picture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    provider: 'google',
    role: 'borrower',
    linkedBorrowerId: 'baws-user-aarti-8821',
    loginTimestamp: new Date().toISOString(),
  },
};

/**
 * Returns OAuth authorization URLs for Google / GitHub or Demo sign in
 */
export function getOAuthAuthUrl(provider: 'google' | 'github', appUrl: string, state?: string) {
  const origin = appUrl.replace(/\/$/, '');
  const redirectUri = `${origin}/auth/callback`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return {
        configured: false,
        url: null,
        message: 'GOOGLE_CLIENT_ID environment variable is not configured.',
        redirectUri,
      };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      state: state || 'provider=google',
      prompt: 'select_account',
    });

    return {
      configured: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return {
        configured: false,
        url: null,
        message: 'GITHUB_CLIENT_ID environment variable is not configured.',
        redirectUri,
      };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state: state || 'provider=github',
    });

    return {
      configured: true,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  throw new Error(`Unsupported OAuth provider: ${provider}`);
}

/**
 * Exchange OAuth authorization code for profile data
 */
export async function exchangeOAuthCode(
  code: string,
  provider: 'google' | 'github',
  appUrl: string
): Promise<OAuthUser> {
  const origin = appUrl.replace(/\/$/, '');
  const redirectUri = `${origin}/auth/callback`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured.');
    }

    // Exchange token
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const accessToken = tokenRes.data.access_token;

    // Fetch user info
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const googleUser = userRes.data;
    const user: OAuthUser = {
      id: `google_${googleUser.sub}`,
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      picture: googleUser.picture,
      provider: 'google',
      accessToken,
      role: 'borrower',
      linkedBorrowerId: 'baws-user-aarti-8821',
      loginTimestamp: new Date().toISOString(),
    };

    authenticatedSessions[user.id] = user;
    return user;
  }

  if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth credentials not configured.');
    }

    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to obtain GitHub access token');
    }

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'BAWS-App' },
    });

    const ghUser = userRes.data;
    const user: OAuthUser = {
      id: `github_${ghUser.id}`,
      email: ghUser.email || `${ghUser.login}@users.noreply.github.com`,
      name: ghUser.name || ghUser.login,
      picture: ghUser.avatar_url,
      provider: 'github',
      accessToken,
      role: 'borrower',
      linkedBorrowerId: 'baws-user-aarti-8821',
      loginTimestamp: new Date().toISOString(),
    };

    authenticatedSessions[user.id] = user;
    return user;
  }

  throw new Error('Unsupported provider for code exchange');
}

/**
 * Creates or logs in a one-click demo OAuth account for instant testing
 */
export function createDemoOAuthSession(
  role: 'borrower' | 'underwriter',
  email?: string,
  name?: string
): OAuthUser {
  const sessionId = `demo_${Date.now()}`;
  const user: OAuthUser = {
    id: sessionId,
    email: email || (role === 'borrower' ? 'nilavra.s2007@gmail.com' : 'underwriter.desk@nbfc-risk.in'),
    name: name || (role === 'borrower' ? 'Aarti Patel (Adaptive Borrower)' : 'Dev Sharma (Senior Risk Officer)'),
    picture:
      role === 'borrower'
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    provider: 'demo',
    role,
    linkedBorrowerId: role === 'borrower' ? 'baws-user-aarti-8821' : undefined,
    loginTimestamp: new Date().toISOString(),
  };

  authenticatedSessions[sessionId] = user;
  return user;
}
