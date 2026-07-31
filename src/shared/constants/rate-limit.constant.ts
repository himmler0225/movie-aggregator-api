export const RATE_LIMIT = {
  authRegister: { keyPrefix: 'auth:register', limit: 5, windowMs: 60000 },
  authLogin: { keyPrefix: 'auth:login', limit: 10, windowMs: 60000 },
  authResetPassword: {
    keyPrefix: 'auth:reset-password',
    limit: 3,
    windowMs: 300000,
  },
  authRefresh: {
    keyPrefix: 'auth:refresh',
    limit: 30,
    windowMs: 60000,
  },
  watchPartyJoin: {
    keyPrefix: 'watch-party:join',
    limit: 10,
    windowMs: 60000,
  },
  analyticsPageView: {
    keyPrefix: 'analytics:page-view',
    limit: 60,
    windowMs: 60000,
  },
  analyticsSearch: {
    keyPrefix: 'analytics:search',
    limit: 30,
    windowMs: 60000,
  },
} as const;
