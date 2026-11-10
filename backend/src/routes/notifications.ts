import { Router, Response } from "express";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { dispatchDueNotifications } from "../services/notification-dispatch";

const router = Router();

router.post("/dispatch", async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const header = req.headers.authorization || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || supplied.length !== secret.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return res.status(401).json({ error: "Invalid dispatch authorization." });
  }
  try {
    const result = await dispatchDueNotifications();
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, ...result, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error("Notification dispatch failed:", error);
    res.status(500).json({
      error: "Notification dispatch failed.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown dispatcher error",
    });
  }
});

router.get("/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [preference, user] = await Promise.all([
      prisma.notificationPreference.findUnique({ where: { ownerUserId: req.userId } }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { email: true, mobile: true } }),
    ]);
    res.json({
      preferences: {
        emailEnabled: preference?.emailEnabled || false,
        whatsappEnabled: preference?.whatsappEnabled || false,
        smsEnabled: preference?.smsEnabled || false,
        emailAvailable: Boolean(user?.email),
        mobileAvailable: Boolean(user?.mobile),
        emailConsentAt: preference?.emailConsentAt || null,
        whatsappConsentAt: preference?.whatsappConsentAt || null,
        smsConsentAt: preference?.smsConsentAt || null,
      },
    });
  } catch {
    res.status(500).json({ error: "Unable to load notification preferences." });
  }
});

router.patch("/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const v = z.object({
      emailEnabled: z.boolean(),
      whatsappEnabled: z.boolean(),
      smsEnabled: z.boolean(),
    }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, mobile: true },
    });
    if (v.emailEnabled && !user?.email) return res.status(400).json({ error: "Add an email address to your account before enabling email reminders." });
    if ((v.whatsappEnabled || v.smsEnabled) && !user?.mobile) return res.status(400).json({ error: "Add a mobile number to your account before enabling WhatsApp or SMS reminders." });

    const old = await prisma.notificationPreference.findUnique({ where: { ownerUserId: req.userId! } });
    const now = new Date();
    const preference = await prisma.notificationPreference.upsert({
      where: { ownerUserId: req.userId! },
      create: {
        ownerUserId: req.userId!,
        ...v,
        emailConsentAt: v.emailEnabled ? now : null,
        whatsappConsentAt: v.whatsappEnabled ? now : null,
        smsConsentAt: v.smsEnabled ? now : null,
      },
      update: {
        ...v,
        emailConsentAt: v.emailEnabled ? (old?.emailEnabled ? old.emailConsentAt : now) : null,
        whatsappConsentAt: v.whatsappEnabled ? (old?.whatsappEnabled ? old.whatsappConsentAt : now) : null,
        smsConsentAt: v.smsEnabled ? (old?.smsEnabled ? old.smsConsentAt : now) : null,
      },
    });
    res.json({
      preferences: {
        emailEnabled: preference.emailEnabled,
        whatsappEnabled: preference.whatsappEnabled,
        smsEnabled: preference.smsEnabled,
        emailConsentAt: preference.emailConsentAt,
        whatsappConsentAt: preference.whatsappConsentAt,
        smsConsentAt: preference.smsConsentAt,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save notification preferences." });
  }
});

router.get("/deliveries", authenticate, async (req: AuthRequest, res) => {
  try {
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { ownerUserId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, channel: true, recipient: true, subject: true, status: true,
        attempts: true, lastError: true, scheduledAt: true, sentAt: true, createdAt: true,
      },
    });
    res.json({ deliveries });
  } catch {
    res.status(500).json({ error: "Unable to load notification history." });
  }
});

router.get("/configuration", authenticate, async (_req, res) => {
  const whatsappBase = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  res.json({
    providers: {
      email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      whatsapp: whatsappBase,
      whatsappReminderTemplate: process.env.WHATSAPP_TEMPLATE_NAME || "mhw_reminder",
      whatsappWishTemplate: process.env.WHATSAPP_WISH_TEMPLATE_NAME || "mhw_scheduled_wish",
      whatsappApiVersion: process.env.WHATSAPP_API_VERSION || "v26.0",
      sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      scheduler: Boolean(process.env.CRON_SECRET),
    },
  });
});

// Sends a single utility-template test only to the signed-in account's own mobile.
// The user must click the test button and explicitly confirm this action.
router.post("/whatsapp/test", authenticate, async (req: AuthRequest, res) => {
  try {
    const request = z.object({ confirmSend: z.literal(true) }).parse(req.body);
    if (!request.confirmSend) return res.status(400).json({ error: "Confirm the test message first." });
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return res.status(409).json({ error: "WhatsApp setup is incomplete. Add the Meta access token and phone number ID to Vercel first." });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { mobile: true },
    });
    if (!user?.mobile) {
      return res.status(400).json({ error: "Add your own mobile number to this account before sending a test." });
    }
    const digits = user.mobile.replace(/\\D/g, "");
    const recipient = /^91[6-9]\\d{9}$/.test(digits) ? digits : /^[6-9]\\d{9}$/.test(digits) ? "91" + digits : "";
    if (!recipient) return res.status(400).json({ error: "The account mobile number is not a valid Indian mobile number." });
    const version = (process.env.WHATSAPP_API_VERSION || "v26.0").replace(/^\\/?|\\/$/g, "");
    if (!/^v\\d+\\.\\d+$/.test(version)) return res.status(400).json({ error: "WHATSAPP_API_VERSION must look like v26.0." });
    const template = process.env.WHATSAPP_TEMPLATE_NAME || "mhw_reminder";
    const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
    const response = await fetch("https://graph.facebook.com/" + version + "/" + phoneId + "/messages", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: "My Home Warranty test" },
              { type: "text", text: "WhatsApp Cloud API connection is working." },
            ],
          }],
        },
      }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data.error?.message || "Meta rejected the test message.").slice(0, 350);
      return res.status(response.status === 401 || response.status === 403 ? 502 : 400).json({ error: detail });
    }
    res.json({
      success: true,
      message: "Meta accepted the test message request.",
      providerMessageId: String(data.messages?.[0]?.id || ""),
      recipientLastFour: recipient.slice(-4),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to send WhatsApp test." });
  }
});

export default router;
