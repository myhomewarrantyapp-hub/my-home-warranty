import { Router, Response } from "express";
import { z } from "zod";
import { handleUpload } from "@vercel/blob/client";
import { get } from "@vercel/blob";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const mobileSchema = z.string().regex(/^(?:\+?[1-9][0-9]{7,14}|[6-9][0-9]{9})$/);
const channels = ["WHATSAPP", "SMS", "EMAIL"] as const;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

router.get("/public-media/:token", async (req, res) => {
  try {
    const wish = await prisma.birthdayWish.findUnique({
      where: { mediaShareTokenHash: tokenHash(req.params.token) },
      select: { mediaPath: true, mediaContentType: true, mediaOriginalName: true, mediaShareExpiresAt: true },
    });
    if (!wish?.mediaPath || !wish.mediaShareExpiresAt || wish.mediaShareExpiresAt.getTime() < Date.now()) {
      return res.status(404).json({ error: "This birthday media link has expired or is unavailable." });
    }
    const result = await get(wish.mediaPath, { access: "private" });
    if (!result || result.statusCode !== 200) return res.status(404).json({ error: "Media not found." });
    res.setHeader("Content-Type", wish.mediaContentType || result.blob.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(wish.mediaOriginalName || "birthday-media"));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    Readable.fromWeb(result.stream as any).pipe(res);
  } catch {
    res.status(500).json({ error: "Unable to load birthday media." });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const wishes = await prisma.birthdayWish.findMany({
      where: { ownerUserId: req.userId },
      orderBy: { scheduledAt: "asc" },
      take: 200,
      include: {
        deliveries: {
          select: { id: true, channel: true, status: true, attempts: true, lastError: true, sentAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    res.json({ wishes });
  } catch {
    res.status(500).json({ error: "Unable to load birthday wishes." });
  }
});

router.post("/", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    recipientName: z.string().min(1).max(120),
    recipientMobile: mobileSchema.optional(),
    recipientEmail: z.string().email().max(254).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scheduledAt: z.string().datetime(),
    timezone: z.string().min(1).max(80).default("Asia/Kolkata"),
    message: z.string().max(1200).optional(),
    recurringYearly: z.boolean().default(false),
    whatsappEnabled: z.boolean().default(false),
    smsEnabled: z.boolean().default(false),
    emailEnabled: z.boolean().default(false),
    whatsappConsent: z.boolean().default(false),
    smsConsent: z.boolean().default(false),
    emailConsent: z.boolean().default(false),
  }).superRefine((v, ctx) => {
    if (!v.whatsappEnabled && !v.smsEnabled && !v.emailEnabled) {
      ctx.addIssue({ code: "custom", message: "Choose at least one delivery channel." });
    }
    if (v.whatsappEnabled && (!v.recipientMobile || !v.whatsappConsent)) {
      ctx.addIssue({ code: "custom", message: "WhatsApp needs a mobile number and recorded recipient opt-in." });
    }
    if (v.smsEnabled && (!v.recipientMobile || !v.smsConsent)) {
      ctx.addIssue({ code: "custom", message: "SMS needs a mobile number and recorded recipient opt-in." });
    }
    if (v.emailEnabled && (!v.recipientEmail || !v.emailConsent)) {
      ctx.addIssue({ code: "custom", message: "Email needs an email address and recorded recipient opt-in." });
    }
  });
  try {
    const v = schema.parse(req.body);
    if (new Date(v.scheduledAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: "Choose a future date and time so the birthday wish remains a surprise." });
    }
    const now = new Date();
    const wish = await prisma.birthdayWish.create({
      data: {
        ownerUserId: req.userId!,
        recipientName: v.recipientName,
        recipientMobile: v.recipientMobile,
        recipientEmail: v.recipientEmail?.toLowerCase(),
        birthDate: new Date(v.birthDate + "T12:00:00.000Z"),
        scheduledAt: new Date(v.scheduledAt),
        timezone: v.timezone,
        message: v.message,
        recurringYearly: v.recurringYearly,
        whatsappEnabled: v.whatsappEnabled,
        smsEnabled: v.smsEnabled,
        emailEnabled: v.emailEnabled,
        whatsappConsent: v.whatsappConsent,
        smsConsent: v.smsConsent,
        emailConsent: v.emailConsent,
        whatsappConsentAt: v.whatsappConsent ? now : null,
        smsConsentAt: v.smsConsent ? now : null,
        emailConsentAt: v.emailConsent ? now : null,
        status: "SCHEDULED",
      },
    });
    res.status(201).json({ wish });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid birthday wish." });
  }
});

router.post("/upload-token", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payload = z.object({
      wishId: z.string().min(1),
      originalName: z.string().min(1).max(180),
      contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]),
    }).parse(JSON.parse(String(req.body?.clientPayload || "{}")));
    const wish = await prisma.birthdayWish.findFirst({
      where: { id: payload.wishId, ownerUserId: req.userId },
      select: { id: true },
    });
    if (!wish) return res.status(404).json({ error: "Birthday wish not found." });

    const response = await handleUpload({
      body: req.body,
      request: req as any,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const data = z.object({
          wishId: z.string(),
          originalName: z.string(),
          contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]),
        }).parse(JSON.parse(clientPayload || "{}"));
        if (data.wishId !== wish.id || !pathname.startsWith("birthday-wishes/" + req.userId + "/" + wish.id + "/")) {
          throw new Error("Invalid birthday media upload target.");
        }
        return {
          access: "private",
          addRandomSuffix: true,
          allowedContentTypes: [data.contentType],
          maximumSizeInBytes: data.contentType.startsWith("video/") ? 100 * 1024 * 1024 : 12 * 1024 * 1024,
          tokenPayload: JSON.stringify({ ownerUserId: req.userId, wishId: wish.id, originalName: data.originalName }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const data = z.object({ ownerUserId: z.string(), wishId: z.string(), originalName: z.string() }).parse(JSON.parse(tokenPayload));
        await prisma.birthdayWish.updateMany({
          where: { id: data.wishId, ownerUserId: data.ownerUserId },
          data: {
            mediaPath: blob.pathname,
            mediaContentType: blob.contentType,
            mediaOriginalName: data.originalName,
            mediaShareTokenHash: null,
            mediaShareExpiresAt: null,
          },
        });
      },
    });
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to prepare media upload." });
  }
});

router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const v = z.object({ status: z.enum(["CANCELLED"]) }).parse(req.body);
    const updated = await prisma.birthdayWish.updateMany({
      where: { id: req.params.id, ownerUserId: req.userId, status: "SCHEDULED" },
      data: { status: v.status, deliveryNote: "Cancelled by the account owner." },
    });
    if (!updated.count) return res.status(404).json({ error: "Scheduled birthday wish not found." });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update birthday wish." });
  }
});

export default router;
