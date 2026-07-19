export const APP_URL_DEFAULTS = {
  frontend: 'http://localhost:8080',
  api: 'http://localhost:3001',
} as const;

export const MOVIE_SOURCE_URLS = {
  kkphim: {
    api: 'https://phimapi.com',
    images: 'https://phimimg.com/',
  },
  ophim: {
    api: 'https://ophim1.com',
    images: 'https://img.ophim.live/uploads/movies/',
  },
  vsmov: {
    api: 'https://vsmov.com/api',
    images: 'https://vsmov.com/',
  },
} as const;

export const GOOGLE_OAUTH_URLS = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  userInfo: 'https://www.googleapis.com/oauth2/v3/userinfo',
} as const;

export const GOOGLE_OAUTH_CALLBACK_PATH = '/api/auth/google/callback';
export const FRONTEND_AUTH_CALLBACK_PATH = '/auth/callback';
