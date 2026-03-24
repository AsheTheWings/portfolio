'use client';

/**
 * HTTP Client for Next.js API Routes
 * Auth is handled automatically via HTTP-only cookies (Supabase SSR)
 */

const API_URL = '/api';  // Local Next.js API routes

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    throw new ApiError(
      `API Error: ${response.statusText}`,
      response.status,
      errorData.error || errorData.detail || 'Unknown error'
    );
  }
  
  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
}

export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Build headers
   * Note: Auth is handled automatically via HTTP-only cookies (Supabase SSR)
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',  // Include cookies for auth
    });
    return handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',  // Include cookies for auth
      body: body ? JSON.stringify(body) : undefined,
    });
    
    return handleResponse<T>(response);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',  // Include cookies for auth
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',  // Include cookies for auth
    });
    return handleResponse<T>(response);
  }
}

// Singleton instance
export const httpClient = new HttpClient();
