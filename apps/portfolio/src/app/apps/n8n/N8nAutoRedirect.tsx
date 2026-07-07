"use client";

import { useEffect, useRef, useState } from "react";

interface N8nAutoRedirectProps {
	ssoHtml: string;
}

export default function N8nAutoRedirect({ ssoHtml }: N8nAutoRedirectProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const submittedRef = useRef(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (submittedRef.current) return;
		submittedRef.current = true;

		const container = containerRef.current;
		const form = container?.querySelector("form");
		if (!(form instanceof HTMLFormElement)) {
			setError("n8n SSO form was not found.");
			return;
		}

		form.removeAttribute("target");
		form.submit();
	}, []);

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
			<div className="text-center">
				<h1 className="text-lg font-medium">Opening n8n...</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					{error ?? "Redirecting to the n8n editor."}
				</p>
			</div>
			<div ref={containerRef} hidden dangerouslySetInnerHTML={{ __html: ssoHtml }} />
		</main>
	);
}
