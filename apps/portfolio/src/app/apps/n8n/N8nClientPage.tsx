"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Cpu, Copy, Check, ExternalLink, Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import { getN8nSsoHtml, generateN8nPat } from "./actions";

interface N8nClientPageProps {
	user: {
		userId: string;
		username: string;
	};
}

export default function N8nClientPage({ user }: N8nClientPageProps) {
	const [ssoLoading, setSsoLoading] = useState(false);
	const [patLoading, setPatLoading] = useState(false);
	const [patToken, setPatToken] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleLaunchN8n = async () => {
		setSsoLoading(true);
		setError(null);
		try {
			const formHtml = await getN8nSsoHtml();

			// Inject and submit form dynamically in a temporary div
			const div = document.createElement("div");
			div.innerHTML = formHtml;
			document.body.appendChild(div);

			const form = div.querySelector("form");
			if (form) {
				form.target = "_blank"; // Open workspace in a new tab
				form.submit();
			} else {
				throw new Error("Handshake form not found in SSO response.");
			}

			// Clean up the temporary container
			setTimeout(() => {
				document.body.removeChild(div);
			}, 1000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to launch n8n workspace");
		} finally {
			setSsoLoading(false);
		}
	};

	const handleGeneratePat = async () => {
		setPatLoading(true);
		setError(null);
		try {
			const { token } = await generateN8nPat();
			setPatToken(token);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to generate personal access token");
		} finally {
			setPatLoading(false);
		}
	};

	const handleCopyToken = () => {
		if (!patToken) return;
		navigator.clipboard.writeText(patToken);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<main className="min-h-dvh bg-background text-foreground p-6 lg:p-10 flex flex-col justify-center">
			<div className="mx-auto w-full max-w-4xl">
				{/* Navigation Back Link */}
				<div className="mb-8">
					<Link
						href="/"
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
					>
						<ArrowLeft size="16" className="transition-transform group-hover:-translate-x-1" />
						Back to App Choice Board
					</Link>
				</div>

				{/* Header Section */}
				<div className="mb-10 max-w-3xl">
					<p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">App Integration</p>
					<h1 className="text-4xl font-semibold tracking-tight lg:text-6xl flex items-center gap-4">
						n8n Automation
					</h1>
					<p className="mt-4 text-lg text-muted-foreground">
						Connect external services, schedule routines, and run automated tasks using your active Timeline sessions.
					</p>
				</div>

				{/* Global Error Banner */}
				{error && (
					<div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
						{error}
					</div>
				)}

				<div className="grid gap-6 md:grid-cols-2">
					{/* Launch Card */}
					<div className="rounded-3xl border border-border-subtle bg-surface-1 p-8 shadow-depth-sm flex flex-col justify-between">
						<div>
							<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-foreground">
								<Cpu size="28" />
							</div>
							<h2 className="text-2xl font-semibold mb-3">n8n Workspace</h2>
							<p className="text-sm text-muted-foreground leading-relaxed mb-6">
								Open your visual workflow canvas in a new tab. You will be authenticated automatically via secure SSO under your Timeline identity (<strong>{user.username}</strong>).
							</p>
						</div>

						<button
							onClick={handleLaunchN8n}
							disabled={ssoLoading}
							className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer text-sm"
						>
							{ssoLoading ? "Authenticating..." : "Launch n8n Workspace"}
							<ExternalLink size="16" />
						</button>
					</div>

					{/* Token Card */}
					<div className="rounded-3xl border border-border-subtle bg-surface-1 p-8 shadow-depth-sm flex flex-col justify-between">
						<div>
							<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-foreground">
								<Lock size="28" />
							</div>
							<h2 className="text-2xl font-semibold mb-3">Timeline Connection Token</h2>
							<p className="text-sm text-muted-foreground leading-relaxed mb-6">
								To call Timeline session endpoints securely from n8n workflows, generate a scoped Personal Access Token. This token acts as a Bearer credential inside n8n.
							</p>
						</div>

						{!patToken ? (
							<button
								onClick={handleGeneratePat}
								disabled={patLoading}
								className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-medium border border-border bg-surface-2 text-foreground hover:bg-surface-3 transition-colors cursor-pointer text-sm"
							>
								{patLoading ? "Generating..." : "Generate Connection Token"}
							</button>
						) : (
							<div className="w-full">
								<div className="relative mb-3">
									<input
										type="text"
										readOnly
										value={patToken}
										className="w-full pr-12 pl-4 py-3 rounded-xl border border-border bg-surface-2 text-xs font-mono select-all overflow-ellipsis focus:outline-none"
									/>
									<button
										onClick={handleCopyToken}
										className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
										title="Copy to Clipboard"
									>
										{copied ? <Check size="16" className="text-green-500" /> : <Copy size="16" />}
									</button>
								</div>
								<p className="text-xs text-green-500 flex items-center gap-1">
									<ShieldCheck size="14" />
									Token generated! Copy and use as standard Bearer header.
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Technical Instructions Footer */}
				{patToken && (
					<div className="mt-8 p-6 rounded-2xl border border-border bg-surface-1 shadow-depth-sm">
						<h3 className="text-sm font-semibold mb-3">How to use this token in n8n:</h3>
						<ol className="list-decimal list-inside text-xs text-muted-foreground space-y-2">
							<li>Open n8n and go to <strong className="text-foreground">Credentials</strong> → <strong className="text-foreground">Add Credential</strong>.</li>
							<li>Select <strong className="text-foreground">Header Auth</strong> as the credential type.</li>
							<li>Set Name as <strong className="text-foreground">Authorization</strong> and Value as <strong className="text-foreground">Bearer &lt;your_copied_token&gt;</strong>.</li>
							<li>In your workflows, use the <strong className="text-foreground">HTTP Request</strong> node to query Timeline session API routes securely.</li>
						</ol>
					</div>
				)}
			</div>
		</main>
	);
}
