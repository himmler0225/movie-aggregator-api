export const ROLE = {
  USER: 'user',
  PREMIUM: 'premium',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];
