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
  } catch {
    res.status(500).json({ error: "Notification dispatch failed." });
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
        emailConsentAt: v.emailEnabled && !old?.emailConsentAt ? now : old?.emailConsentAt,
        whatsappConsentAt: v.whatsappEnabled && !old?.whatsappConsentAt ? now : old?.whatsappConsentAt,
        smsConsentAt: v.smsEnabled && !old?.smsConsentAt ? now : old?.smsConsentAt,
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
  res.json({
    providers: {
      email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME && process.env.WHATSAPP_API_VERSION),
      sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      scheduler: Boolean(process.env.CRON_SECRET),
    },
  });
});

export default router;
