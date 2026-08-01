import api from './base';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  githubLogin: string;
  avatarUrl: string | null;
  displayCurrency?: string;
}

export interface ProfileResponse {
  user: AuthUser;
}

const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace(/\/$/, '');

/**
 * Sign-in is a full-page redirect rather than an XHR: the browser has to visit
 * github.com and be sent back, which cannot happen inside a fetch. `return_to`
 * carries the page the user was on so they land back where they started.
 */
export const githubLoginUrl = (returnTo: string = window.location.href): string => {
  const params = new URLSearchParams({ return_to: returnTo });
  return `${API_ORIGIN}/api/auth/github/login?${params.toString()}`;
};

export const authApi = {
  getProfile: async (): Promise<ProfileResponse> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  }
};
