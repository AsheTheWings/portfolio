import { verifyToken } from "@portfolio/auth/lib/cookies";
import { redirect } from "next/navigation";
import { getN8nSsoHtml } from "./actions";
import N8nAutoRedirect from "./N8nAutoRedirect";

/**
 * Server-side Page component for /apps/n8n.
 * Enforces Timeline authentication before sending the user into n8n.
 */
export default async function N8nPage() {
	const user = await verifyToken();
	if (!user) {
		redirect("/apps/timeline?redirect=/apps/n8n");
	}

	const ssoHtml = await getN8nSsoHtml();

	return <N8nAutoRedirect ssoHtml={ssoHtml} />;
}
