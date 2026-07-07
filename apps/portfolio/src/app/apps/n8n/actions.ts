"use server";

import { getTokenCookie } from "@portfolio/auth/lib/cookies";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

async function authHeaders(): Promise<Record<string, string>> {
	const token = await getTokenCookie();
	if (!token) throw new Error("Unauthorized");
	return { Authorization: `Bearer ${token}` };
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
