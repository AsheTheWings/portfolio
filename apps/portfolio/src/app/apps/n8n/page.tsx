import { verifyToken } from "@portfolio/auth/lib/cookies";
import { redirect } from "next/navigation";
import N8nClientPage from "./N8nClientPage";
import { getN8nConnection } from "./actions";

/**
 * Server-side Page component for /apps/n8n.
 * Enforces Timeline authentication before mounting the Client Launch Hub.
 */
export default async function N8nPage() {
	const user = await verifyToken();
	if (!user) {
		redirect("/signin?redirect=/apps/n8n");
	}
	const connection = await getN8nConnection().catch(() => ({
		connected: false,
		provisioned: false,
		last4: null,
		credentialId: null,
		updatedAt: null,
	}));

	return <N8nClientPage user={user} initialConnection={connection} />;
}
