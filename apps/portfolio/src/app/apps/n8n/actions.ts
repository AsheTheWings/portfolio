"use server";

import { getTokenCookie } from "@portfolio/auth/lib/cookies";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3011";

/**
 * Server action to retrieve the auto-submitting n8n SSO form from the backend.
 */
export async function getN8nSsoHtml(): Promise<string> {
	const token = await getTokenCookie();
	if (!token) {
		throw new Error("Unauthorized");
	}

	const res = await fetch(`${BACKEND_URL}/auth/n8n-sso`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		cache: "no-store",
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Failed to initiate SSO" }));
		throw new Error(err.error || "Failed to initiate SSO");
	}

	return await res.text();
}

/**
 * Server action to generate a long-lived Personal Access Token (PAT) for n8n to communicate back to Timeline.
 */
export async function generateN8nPat(): Promise<{ token: string }> {
	const token = await getTokenCookie();
	if (!token) {
		throw new Error("Unauthorized");
	}

	const res = await fetch(`${BACKEND_URL}/auth/n8n-pat`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		cache: "no-store",
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Failed to generate token" }));
		throw new Error(err.error || "Failed to generate token");
	}

	return await res.json();
}
