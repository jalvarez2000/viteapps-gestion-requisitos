"use server";

import { database } from "@repo/database";
import { redirect } from "next/navigation";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

function getPriceId(size?: string | null): string {
  const map: Record<string, string | undefined> = {
    XS: process.env.STRIPE_PRICE_ID_XS,
    S: process.env.STRIPE_PRICE_ID_S,
    M: process.env.STRIPE_PRICE_ID_M,
    L: process.env.STRIPE_PRICE_ID_L,
    XL: process.env.STRIPE_PRICE_ID_XL,
  };
  const priceId = map[size ?? "XS"] ?? process.env.STRIPE_PRICE_ID_XS;
  if (!priceId) throw new Error("No STRIPE_PRICE_ID configured");
  return priceId;
}

export async function createCheckoutSession(projectCode: string) {
  const project = await database.project.findUnique({
    where: { code: projectCode },
    select: {
      id: true,
      code: true,
      name: true,
      clientEmail: true,
      userSize: true,
      stripeCustomerId: true,
    },
  });

  if (!project) throw new Error("Project not found");

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: getPriceId(project.userSize), quantity: 1 }],
    client_reference_id: project.code,
    customer: project.stripeCustomerId ?? undefined,
    customer_email: project.stripeCustomerId ? undefined : project.clientEmail,
    metadata: { projectCode: project.code },
    subscription_data: {
      description: `Suscripción — ${project.name}`,
      metadata: { projectCode: project.code },
    },
    custom_text: {
      submit: { message: `Proyecto: ${project.name} (${project.code})` },
    },
    success_url: `${appUrl}/portal/${project.code}?subscribed=1`,
    cancel_url: `${appUrl}/portal/${project.code}`,
  });

  redirect(session.url!);
}

export async function createBillingPortalSession(
  projectCode: string,
  returnUrl: string
) {
  const project = await database.project.findUnique({
    where: { code: projectCode },
    select: { stripeCustomerId: true },
  });

  if (!project?.stripeCustomerId) throw new Error("No Stripe customer found");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: project.stripeCustomerId,
    return_url: returnUrl,
  });

  redirect(session.url);
}
