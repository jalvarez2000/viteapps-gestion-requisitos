import { database } from "@repo/database";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const projectCode = session.client_reference_id ?? session.metadata?.projectCode;
      if (!projectCode) break;

      const subscriptionId = session.subscription as string | null;
      const customerId = session.customer as string | null;

      // Fetch subscription status from Stripe
      let status = "active";
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status;
      }

      await database.project.update({
        where: { code: projectCode },
        data: {
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          subscriptionStatus: status,
          subscriptionStatusAt: new Date(),
        },
      });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Use projectCode from subscription metadata (set at checkout) as source
      // of truth — avoids updating the wrong project when a customer has
      // multiple projects sharing the same stripeCustomerId.
      const projectCode = sub.metadata?.projectCode;
      if (projectCode) {
        await database.project.update({
          where: { code: projectCode },
          data: {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status,
            subscriptionStatusAt: new Date(),
          },
        });
      } else {
        // Fallback for subscriptions created before metadata was added.
        // Safe only when customerId maps to exactly one project.
        await database.project.updateMany({
          where: {
            stripeCustomerId: sub.customer as string,
            stripeSubscriptionId: sub.id,
          },
          data: {
            subscriptionStatus: sub.status,
            subscriptionStatusAt: new Date(),
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
