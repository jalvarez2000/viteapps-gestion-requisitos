import { notFound } from "next/navigation";

export const metadata = {
  title: "Webhooks",
  description: "Send webhooks to your users.",
};

// Webhooks are not active in this app.
const WebhooksPage = async () => {
  notFound();
};

export default WebhooksPage;
