"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Cpu, ExternalLink, RefreshCw, ShieldCheck, TriangleAlert, Workflow } from "lucide-react";
import { connectN8n, getN8nSsoHtml, type N8nConnectionStatus } from "./actions";

interface N8nClientPageProps {
	user: {
		userId: string;
		username: string;
	};
	initialConnection: N8nConnectionStatus;
}

export default function N8nClientPage({ user, initialConnection }: N8nClientPageProps) {
	const [connection, setConnection] = useState(initialConnection);
	const [connectionLoading, setConnectionLoading] = useState(false);
	const [launchLoading, setLaunchLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isReady = connection.connected && connection.provisioned;
	const needsProvisioning = connection.connected && !connection.provisioned;

	const handleConnect = async () => {
		setConnectionLoading(true);
		setError(null);
		try {
			const nextConnection = await connectN8n();
			setConnection(nextConnection);
			if (!nextConnection.provisioned && nextConnection.reason === "n8n_api_not_configured") {
				setError("The Timeline bridge is prepared, but n8n credential provisioning is not configured on the backend yet.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to prepare the n8n connection");
		} finally {
			setConnectionLoading(false);
		}
	};

	const handleLaunchN8n = async () => {
		setLaunchLoading(true);
		setError(null);
		try {
			if (!isReady) {
				const nextConnection = await connectN8n();
				setConnection(nextConnection);
				if (!nextConnection.provisioned) {
					throw new Error("n8n bridge provisioning is not complete. Use Repair connection after backend n8n API credentials are configured.");
				}
			}

			const formHtml = await getN8nSsoHtml();
			const div = document.createElement("div");
			div.hidden = true;
			div.innerHTML = formHtml;
			document.body.appendChild(div);

			const form = div.querySelector("form");
			if (!form) throw new Error("Handshake form not found in SSO response.");
			form.target = "_blank";
			form.submit();
			setTimeout(() => div.remove(), 1000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to launch n8n workspace");
		} finally {
			setLaunchLoading(false);
		}
	};

	return (
		<main className="min-h-dvh overflow-auto bg-background p-6 text-foreground lg:p-10">
			<div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col justify-center">
				<Link href="/" className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
					<ArrowLeft size="16" />
					Back to app launcher
				</Link>

				<div className="mb-10 max-w-3xl">
					<p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">Managed Automation</p>
					<h1 className="text-4xl font-semibold tracking-tight lg:text-6xl">n8n Automation</h1>
					<p className="mt-4 text-lg leading-8 text-muted-foreground">
						Launch a private n8n workspace and let workflows read or append Timeline session context through a managed bridge credential.
					</p>
				</div>

				{error && (
					<div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
						<TriangleAlert className="mt-0.5 shrink-0" size="18" />
						<span>{error}</span>
					</div>
				)}

				<div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
					<section className="rounded-3xl border border-border-subtle bg-surface-1 p-8 shadow-depth-sm">
						<div className="mb-8 flex items-start justify-between gap-4">
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
								<Cpu size="28" />
							</div>
							<ConnectionBadge ready={isReady} needsProvisioning={needsProvisioning} />
						</div>
						<h2 className="text-2xl font-semibold">Launch workspace</h2>
						<p className="mt-3 text-sm leading-6 text-muted-foreground">
							You will enter n8n as <strong className="text-foreground">{user.username}</strong> through SSO. Timeline bridge credentials are created server-side and never shown in the browser.
						</p>

						<div className="mt-8 flex flex-col gap-3 sm:flex-row">
							<button
								type="button"
								onClick={handleLaunchN8n}
								disabled={launchLoading || connectionLoading}
								className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								{launchLoading ? "Preparing workspace..." : "Launch n8n Workspace"}
								<ExternalLink size="16" />
							</button>
							<button
								type="button"
								onClick={handleConnect}
								disabled={launchLoading || connectionLoading}
								className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 px-6 py-4 text-sm font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
							>
								<RefreshCw size="16" className={connectionLoading ? "animate-spin" : ""} />
								{connection.connected ? "Repair connection" : "Connect n8n"}
							</button>
						</div>
					</section>

					<section className="rounded-3xl border border-border-subtle bg-surface-1 p-8 shadow-depth-sm">
						<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
							<ShieldCheck size="28" />
						</div>
						<h2 className="text-2xl font-semibold">Timeline Bridge</h2>
						<p className="mt-3 text-sm leading-6 text-muted-foreground">
							Workflows use a managed Header Auth credential named <strong className="text-foreground">Timeline Bridge</strong>. Users do not copy tokens or configure Authorization headers manually.
						</p>
						<div className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">Credential</span>
								<span className="font-medium">{connection.credentialId ? `#${connection.credentialId}` : "Not provisioned"}</span>
							</div>
							<div className="mt-3 flex items-center justify-between gap-3">
								<span className="text-muted-foreground">Secret</span>
								<span className="font-mono">{connection.last4 ? `•••• ${connection.last4}` : "Managed"}</span>
							</div>
						</div>
					</section>
				</div>

				<div className="mt-5 rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-depth-sm">
					<div className="flex items-start gap-4">
						<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
							<Workflow size="22" />
						</div>
						<div>
							<h3 className="font-semibold">Available bridge endpoints</h3>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								Inside n8n, HTTP Request nodes using the managed credential can call <code className="text-foreground">/n8n/sessions</code>, <code className="text-foreground">/n8n/sessions/:id/context</code>, and <code className="text-foreground">/n8n/sessions/:id/append</code>.
							</p>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

function ConnectionBadge({ ready, needsProvisioning }: { ready: boolean; needsProvisioning: boolean }) {
	if (ready) {
		return (
			<span className="inline-flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
				<CheckCircle2 size="14" />
				Connected
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
			<TriangleAlert size="14" />
			{needsProvisioning ? "Provisioning needed" : "Not connected"}
		</span>
	);
}
