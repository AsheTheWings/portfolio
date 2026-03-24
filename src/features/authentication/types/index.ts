/**
 * Authentication types
 */

export interface UserPublic {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserPublic;
}

// API Request/Response types
export interface UserSignup {
  password: string;
  username: string;
  email?: string;
  full_name?: string;
}

export interface UserLogin {
  email: string; // Can be username or email
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: UserPublic;
}

export interface PasswordReset {
  email: string;
}

export interface PasswordUpdate {
  new_password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}
