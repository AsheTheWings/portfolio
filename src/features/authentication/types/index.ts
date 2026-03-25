/**
 * Authentication types — aligned with backend user model
 */

export interface UserPublic {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string | null;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface UserSignup {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
}
