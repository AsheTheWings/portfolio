"use server";

import { getTokenCookie } from "@portfolio/auth/lib/cookies";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export interface N8nConnectionStatus {
	connected: boolean;
	provisioned: boolean;
	last4: string | null;
	credentialId: string | null;
	updatedAt: string | null;
	reason?: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
	const token = await getTokenCookie();
	if (!token) throw new Error("Unauthorized");
	return { Authorization: `Bearer ${token}` };
}

export async function getN8nConnection(): Promise<N8nConnectionStatus> {
	const res = await fetch(`${BACKEND_URL}/n8n/connection`, {
		headers: await authHeaders(),
		cache: "no-store",
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Failed to load n8n connection" }));
		throw new Error(err.error || "Failed to load n8n connection");
	}

	return await res.json();
}

export async function connectN8n(): Promise<N8nConnectionStatus> {
	const res = await fetch(`${BACKEND_URL}/n8n/connection`, {
		method: "POST",
		headers: await authHeaders(),
		cache: "no-store",
	});

	const body = await res.json().catch(() => null);
	if (!res.ok && body?.reason !== "n8n_api_not_configured") {
		throw new Error(body?.error || body?.reason || "Failed to connect n8n");
	}

	return body;
}

/**
 * Server action to retrieve the auto-submitting n8n SSO form from the backend.
 */
export async function getN8nSsoHtml(): Promise<string> {
	const res = await fetch(`${BACKEND_URL}/auth/n8n-sso`, {
		method: "POST",
		headers: await authHeaders(),
		cache: "no-store",
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Failed to initiate SSO" }));
		throw new Error(err.error || "Failed to initiate SSO");
	}

	return await res.text();
}
