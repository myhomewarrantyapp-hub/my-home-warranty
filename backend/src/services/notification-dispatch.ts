import { prisma } from "../db";

type Channel = "WHATSAPP" | "SMS" | "EMAIL";
type DeliveryInput = {
  ownerUserId: string;
  reminderId?: string;
  birthdayWishId?: string;
  channel: Channel;
  recipient: string;
  subject?: string | null;
  message: string;
  scheduledAt: Date;
  idempotencyKey: string;
};

function e164(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (/^[6-9][0-9]{9}$/.test(digits)) return "+91" + digits;
  if (value.startsWith("+") && digits.length >= 8 && digits.length <= 15) return "+" + digits;
  throw new Error("Recipient mobile must be a valid international number (E.164) or a 10-digit Indian mobile number.");
}

async function enqueue(items: DeliveryInput[]) {
  if (!items.length) return 0;
  const result = await prisma.notificationDelivery.createMany({
    data: items.map((item) => ({ ...item, status: "QUEUED", nextAttemptAt: new Date() })),
    skipDuplicates: true,
  });
  return result.count;
}

async function queueDueReminders(now: Date) {
  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", remindAt: { lte: now }, deliveryStatus: "QUEUED" },
    include: {
      owner: {
        select: {
          id: true, name: true, email: true, mobile: true,
          notificationPreference: true,
        },
      },
    },
    take: 100,
    orderBy: { remindAt: "asc" },
  });

  let queued = 0;
  for (const reminder of due) {
    const pref = reminder.owner.notificationPreference;
    const items: DeliveryInput[] = [];
    const message = [
      reminder.title,
      reminder.description || "",
      "Due: " + reminder.dueAt.toISOString(),
    ].filter(Boolean).join("\n");

    if (pref?.emailEnabled && reminder.owner.email) {
      items.push({
        ownerUserId: reminder.ownerUserId, reminderId: reminder.id,
        channel: "EMAIL", recipient: reminder.owner.email,
        subject: "Reminder: " + reminder.title, message,
        scheduledAt: reminder.remindAt,
        idempotencyKey: "reminder/" + reminder.id + "/EMAIL",
      });
    }
    if (pref?.whatsappEnabled && reminder.owner.mobile) {
      items.push({
        ownerUserId: reminder.ownerUserId, reminderId: reminder.id,
        channel: "WHATSAPP", recipient: e164(reminder.owner.mobile),
        subject: "Reminder: " + reminder.title, message,
        scheduledAt: reminder.remindAt,
        idempotencyKey: "reminder/" + reminder.id + "/WHATSAPP",
      });
    }
    if (pref?.smsEnabled && reminder.owner.mobile) {
      items.push({
        ownerUserId: reminder.ownerUserId, reminderId: reminder.id,
        channel: "SMS", recipient: e164(reminder.owner.mobile),
        subject: "Reminder: " + reminder.title, message,
        scheduledAt: reminder.remindAt,
        idempotencyKey: "reminder/" + reminder.id + "/SMS",
      });
    }
    queued += await enqueue(items);
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { deliveryStatus: items.length ? "ENQUEUED" : "IN_APP_ONLY" },
    });
  }
  return { scanned: due.length, queued };
}

async function queueDueBirthdays(now: Date) {
  const due = await prisma.birthdayWish.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    take: 50,
    orderBy: { scheduledAt: "asc" },
  });
  let queued = 0;
  for (const wish of due) {
    const items: DeliveryInput[] = [];
    let shareUrl = "";
    if (wish.mediaPath) {
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
      const tokenHash = createHash(token);
      const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await prisma.birthdayWish.update({
        where: { id: wish.id },
        data: { mediaShareTokenHash: tokenHash, mediaShareExpiresAt: expiry },
      });
      const base = (process.env.PUBLIC_API_BASE_URL || "https://my-home-warranty-api.vercel.app").replace(/\/$/, "");
      shareUrl = base + "/v1/birthday-wishes/public-media/" + token;
    }

    const message = [
      "Happy Birthday, " + wish.recipientName + "!",
      wish.message || "Wishing you a wonderful birthday filled with happiness.",
      shareUrl ? "Your photo/video: " + shareUrl : "",
    ].filter(Boolean).join("\n");
    const stamp = wish.scheduledAt.toISOString();
    if (wish.emailEnabled && wish.emailConsent && wish.recipientEmail) {
      items.push({
        ownerUserId: wish.ownerUserId, birthdayWishId: wish.id,
        channel: "EMAIL", recipient: wish.recipientEmail,
        subject: "Birthday wishes for " + wish.recipientName, message,
        scheduledAt: wish.scheduledAt,
        idempotencyKey: "birthday/" + wish.id + "/" + stamp + "/EMAIL",
      });
    }
    if (wish.whatsappEnabled && wish.whatsappConsent && wish.recipientMobile) {
      items.push({
        ownerUserId: wish.ownerUserId, birthdayWishId: wish.id,
        channel: "WHATSAPP", recipient: e164(wish.recipientMobile),
        subject: "Happy Birthday, " + wish.recipientName, message,
        scheduledAt: wish.scheduledAt,
        idempotencyKey: "birthday/" + wish.id + "/" + stamp + "/WHATSAPP",
      });
    }
    if (wish.smsEnabled && wish.smsConsent && wish.recipientMobile) {
      items.push({
        ownerUserId: wish.ownerUserId, birthdayWishId: wish.id,
        channel: "SMS", recipient: e164(wish.recipientMobile),
        subject: "Happy Birthday, " + wish.recipientName, message,
        scheduledAt: wish.scheduledAt,
        idempotencyKey: "birthday/" + wish.id + "/" + stamp + "/SMS",
      });
    }
    if (!items.length) {
      await prisma.birthdayWish.update({
        where: { id: wish.id },
        data: { status: "FAILED", deliveryNote: "No selected channel has a recipient and recorded opt-in consent." },
      });
      continue;
    }
    queued += await enqueue(items);
    await prisma.birthdayWish.update({
      where: { id: wish.id },
      data: { status: "PROCESSING", deliveryNote: "Queued for the selected channels." },
    });
  }
  return { scanned: due.length, queued };
}

function createHash(value: string) {
  return require("node:crypto").createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character] || character));
}

async function sendEmail(delivery: { recipient: string; subject: string | null; message: string; idempotencyKey: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) throw new Error("Email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.");
  const text = delivery.message;
  const html = "<div style=\"font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap\">" + escapeHtml(text) + "</div>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      "Idempotency-Key": delivery.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from, to: [delivery.recipient],
      subject: delivery.subject || "My Home Warranty notification",
      text, html,
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Email provider: " + String(data.message || data.name || response.status).slice(0, 300));
  return String(data.id || "");
}

async function sendWhatsApp(delivery: { recipient: string; subject: string | null; message: string; idempotencyKey: string }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const version = process.env.WHATSAPP_API_VERSION;
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
  if (!token || !phoneId || !template || !version) {
    throw new Error("WhatsApp is not configured. Add the Meta Cloud API token, phone number ID, API version and approved template name.");
  }
  const response = await fetch("https://graph.facebook.com/" + version.replace(/^\/?/, "") + "/" + phoneId + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: delivery.recipient.replace(/\D/g, ""),
      type: "template",
      template: {
        name: template,
        language: { code: language },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: String(delivery.subject || "My Home Warranty") },
            { type: "text", text: delivery.message.slice(0, 900) },
          ],
        }],
      },
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("WhatsApp provider: " + String(data.error?.message || response.status).slice(0, 300));
  return String(data.messages?.[0]?.id || "");
}

async function sendSms(delivery: { recipient: string; message: string; idempotencyKey: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !auth || !from) throw new Error("SMS is not configured. Add Twilio Account SID, Auth Token and sender number.");
  const form = new URLSearchParams({
    To: delivery.recipient,
    From: from,
    Body: delivery.message.slice(0, 1400),
  });
  const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(sid + ":" + auth).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("SMS provider: " + String(data.message || response.status).slice(0, 300));
  return String(data.sid || "");
}

async function deliver(delivery: any) {
  if (delivery.channel === "EMAIL") return sendEmail(delivery);
  if (delivery.channel === "WHATSAPP") return sendWhatsApp(delivery);
  if (delivery.channel === "SMS") return sendSms(delivery);
  throw new Error("Unsupported notification channel.");
}

async function finishBirthdayWishes() {
  const processing = await prisma.birthdayWish.findMany({
    where: { status: "PROCESSING" },
    take: 100,
  });
  for (const wish of processing) {
    const deliveries = await prisma.notificationDelivery.findMany({ where: { birthdayWishId: wish.id } });
    if (!deliveries.length || deliveries.some((item) => item.status === "QUEUED" || item.status === "SENDING")) continue;
    const failed = deliveries.filter((item) => item.status !== "SENT");
    if (failed.length) {
      await prisma.birthdayWish.update({
        where: { id: wish.id },
        data: { status: "FAILED", deliveryNote: failed.map((item) => item.channel + ": " + (item.lastError || item.status)).join("; ").slice(0, 900) },
      });
      continue;
    }
    if (wish.recurringYearly) {
      const next = new Date(wish.scheduledAt);
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      await prisma.birthdayWish.update({
        where: { id: wish.id },
        data: {
          status: "SCHEDULED", scheduledAt: next,
          deliveryNote: "Sent through the selected providers. Next yearly wish is scheduled.",
          mediaShareTokenHash: null, mediaShareExpiresAt: null,
        },
      });
    } else {
      await prisma.birthdayWish.update({
        where: { id: wish.id },
        data: { status: "SENT", deliveryNote: "Accepted by the selected message providers." },
      });
    }
  }
}

export async function dispatchDueNotifications() {
  const now = new Date();
  const reminders = await queueDueReminders(now);
  const birthdays = await queueDueBirthdays(now);
  const queued = await prisma.notificationDelivery.findMany({
    where: { status: "QUEUED", nextAttemptAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const item of queued) {
    const claim = await prisma.notificationDelivery.updateMany({
      where: { id: item.id, status: "QUEUED" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (!claim.count) continue;
    const attempt = item.attempts + 1;
    try {
      const providerMessageId = await deliver(item);
      await prisma.notificationDelivery.update({
        where: { id: item.id },
        data: { status: "SENT", providerMessageId, sentAt: new Date(), lastError: null },
      });
      sent++;
    } catch (error) {
      const message = (error instanceof Error ? error.message : "Delivery failed").slice(0, 900);
      const terminal = attempt >= 4;
      await prisma.notificationDelivery.update({
        where: { id: item.id },
        data: {
          status: terminal ? "FAILED" : "QUEUED",
          nextAttemptAt: new Date(Date.now() + [5, 30, 120, 0][attempt - 1] * 60_000),
          lastError: message,
        },
      });
      if (terminal) failed++; else retried++;
    }
  }

  await finishBirthdayWishes();
  return { reminders, birthdays, attempted: queued.length, sent, retried, failed };
}
