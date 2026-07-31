export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface SessionUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
}

export interface SessionResponse {
  access_token: string;
  expires_at: number;
  refresh_token?: string;
  user: SessionUser;
}

export interface OAuthState {
  frontendRedirect: string;
  expiresAt: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}
