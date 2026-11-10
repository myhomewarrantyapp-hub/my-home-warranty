import { prisma } from "../db";
import { createHash, randomBytes } from "node:crypto";
type Channel = "WHATSAPP" | "SMS" | "EMAIL";

type DeliveryInput = {
  ownerUserId: string;
  reminderId?: string;
  birthdayWishId?: string;
  moneyEntryId?: string;
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
    // Never dispatch before each message's scheduled time.
    data: items.map((item) => ({ ...item, status: "QUEUED", nextAttemptAt: item.scheduledAt })),
    skipDuplicates: true,
  });
  return result.count;
}

async function queueDueRecordReminders(now: Date) {
  const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const [bills, money, vehicleEvents, policies, assets] = await Promise.all([
    prisma.bill.findMany({ where: { status: "PENDING", dueDate: { lte: horizon } }, take: 500, select: { id: true, ownerUserId: true, billType: true, provider: true, amount: true, dueDate: true } }),
    prisma.moneyEntry.findMany({ where: { status: "PENDING", balance: { gt: 0 }, dueDate: { not: null, lte: horizon } }, take: 500, select: { id: true, ownerUserId: true, direction: true, personName: true, balance: true, dueDate: true } }),
    prisma.vehicleEvent.findMany({ where: { nextDueDate: { not: null, lte: horizon } }, take: 500, select: { id: true, ownerUserId: true, eventType: true, nextDueDate: true, nextDueOdometer: true, vehicle: { select: { nickname: true, makeModel: true, currentOdometer: true } } } }),
    prisma.insurancePolicy.findMany({ where: { premiumDue: { not: null, lte: horizon } }, take: 500, select: { id: true, ownerUserId: true, insurer: true, policyType: true, premiumAmount: true, premiumDue: true } }),
    prisma.asset.findMany({ where: { warrantyEnd: { not: null, lte: horizon } }, take: 500, select: { id: true, ownerUserId: true, title: true, category: true, warrantyEnd: true } }),
  ]);
  const data: any[] = [];
  const add = (ownerUserId: string, sourceType: string, sourceId: string, label: string, detail: string, dueValue: Date | null) => {
    if (!dueValue) return;
    const dueAt = new Date(dueValue);
    const remindAt = new Date(Math.max(now.getTime(), dueAt.getTime() - 24 * 60 * 60 * 1000));
    data.push({
      ownerUserId, sourceType, sourceId,
      sourceKey: sourceType + ":" + sourceId + ":" + dueAt.toISOString(),
      title: label, description: detail,
      dueAt, remindAt, status: "PENDING", deliveryStatus: "QUEUED",
    });
  };
  for (const bill of bills) add(bill.ownerUserId, "BILL", bill.id, "Bill due: " + (bill.provider || bill.billType), "Amount: ₹" + String(bill.amount), bill.dueDate);
  for (const entry of money) add(entry.ownerUserId, "MONEY", entry.id, (entry.direction === "GIVEN" ? "Money to receive from " : "Money to repay to ") + entry.personName, "Outstanding balance: ₹" + String(entry.balance), entry.dueDate);
  for (const event of vehicleEvents) {
    const vehicleLabel = event.vehicle.nickname || event.vehicle.makeModel || event.eventType;
    add(event.ownerUserId, "VEHICLE_SERVICE", event.id, "Vehicle due: " + vehicleLabel, "Next " + event.eventType.toLowerCase() + " service", event.nextDueDate);
    if (event.nextDueOdometer !== null && event.vehicle.currentOdometer !== null && event.vehicle.currentOdometer >= event.nextDueOdometer) {
      data.push({
        ownerUserId: event.ownerUserId, sourceType: "VEHICLE_ODOMETER", sourceId: event.id,
        sourceKey: "VEHICLE_ODOMETER:" + event.id + ":" + event.nextDueOdometer,
        title: "Vehicle service odometer due: " + vehicleLabel,
        description: "Current odometer " + event.vehicle.currentOdometer + " km · Service due at " + event.nextDueOdometer + " km",
        dueAt: now, remindAt: now, status: "PENDING", deliveryStatus: "QUEUED",
      });
    }
  }
  for (const policy of policies) add(policy.ownerUserId, "INSURANCE", policy.id, "Insurance premium due: " + policy.insurer, policy.policyType + (policy.premiumAmount ? " · ₹" + String(policy.premiumAmount) : ""), policy.premiumDue);
  for (const asset of assets) add(asset.ownerUserId, "WARRANTY", asset.id, "Warranty ending: " + asset.title, asset.category, asset.warrantyEnd);
  const created = data.length ? await prisma.reminder.createMany({ data, skipDuplicates: true }) : { count: 0 };
  return { scanned: bills.length + money.length + vehicleEvents.length + policies.length + assets.length, created: created.count };
}

async function queueDueReminders(now: Date) {
  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", remindAt: { lte: now }, deliveryStatus: { in: ["QUEUED", "IN_APP_ONLY"] } },
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

async function queueDueMoneyContactReminders(now: Date) {
  const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const entries = await prisma.moneyEntry.findMany({
    where: {
      status: "PENDING", direction: "GIVEN", balance: { gt: 0 },
      contactReminderEnabled: true, contactReminderConsentAt: { not: null },
      mobile: { not: null }, dueDate: { not: null, lte: horizon },
    },
    take: 200,
    orderBy: { dueDate: "asc" },
  });
  const items: DeliveryInput[] = [];
  for (const entry of entries) {
    const dueAt = entry.dueDate!;
    const scheduledAt = new Date(Math.max(now.getTime(), dueAt.getTime() - 24 * 60 * 60 * 1000));
    const message = "Hi " + entry.personName + ", this is a friendly reminder about the ₹" + String(entry.balance) + " outstanding amount. The agreed due date is " + dueAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) + ". Please contact me if you have already paid. Thank you.";
    const stamp = dueAt.toISOString();
    if (entry.contactWhatsAppEnabled && entry.mobile) {
      items.push({
        ownerUserId: entry.ownerUserId, moneyEntryId: entry.id,
        channel: "WHATSAPP", recipient: e164(entry.mobile),
        subject: "Friendly payment reminder", message, scheduledAt,
        idempotencyKey: "money-contact/" + entry.id + "/" + stamp + "/WHATSAPP",
      });
    }
    if (entry.contactSmsEnabled && entry.mobile) {
      items.push({
        ownerUserId: entry.ownerUserId, moneyEntryId: entry.id,
        channel: "SMS", recipient: e164(entry.mobile),
        subject: "Friendly payment reminder", message, scheduledAt,
        idempotencyKey: "money-contact/" + entry.id + "/" + stamp + "/SMS",
      });
    }
  }
  const queued = await enqueue(items);
  return { scanned: entries.length, queued };
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
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await prisma.birthdayWish.update({
        where: { id: wish.id },
        data: { mediaShareTokenHash: tokenHash, mediaShareExpiresAt: expiry },
      });
      const base = (process.env.PUBLIC_API_BASE_URL || "https://my-home-warranty-api.vercel.app").replace(/\/$/, "");
      shareUrl = base + "/v1/birthday-wishes/public-media/" + token;
    }

    const occasion = ({
      BIRTHDAY: "Happy Birthday",
      ANNIVERSARY: "Happy Anniversary",
      FESTIVAL: "Warm festival wishes",
      CONGRATULATIONS: "Congratulations",
      HOUSEWARMING: "Happy Housewarming",
      CUSTOM: "A special wish",
    } as Record<string, string>)[wish.wishType] || "A special wish";
    const defaultMessage = ({
      BIRTHDAY: "Wishing you a wonderful birthday filled with happiness.",
      ANNIVERSARY: "Wishing you both many more years of love and happiness.",
      FESTIVAL: "May this festival bring happiness, peace and prosperity.",
      CONGRATULATIONS: "Congratulations on your wonderful achievement!",
      HOUSEWARMING: "Wishing you happiness and wonderful memories in your new home.",
      CUSTOM: "Sending you warm wishes on this special occasion.",
    } as Record<string, string>)[wish.wishType] || "Sending you warm wishes.";
    const message = [
      occasion + ", " + wish.recipientName + "!",
      wish.message || defaultMessage,
      shareUrl ? "Your photo/video: " + shareUrl : "",
    ].filter(Boolean).join("\n");
    const stamp = wish.scheduledAt.toISOString();
    if (wish.emailEnabled && wish.emailConsent && wish.recipientEmail) {
      items.push({
        ownerUserId: wish.ownerUserId, birthdayWishId: wish.id,
        channel: "EMAIL", recipient: wish.recipientEmail,
        subject: occasion + " for " + wish.recipientName, message,
        scheduledAt: wish.scheduledAt,
        idempotencyKey: "birthday/" + wish.id + "/" + stamp + "/EMAIL",
      });
    }
    if (wish.whatsappEnabled && wish.whatsappConsent && wish.recipientMobile) {
      items.push({
        ownerUserId: wish.ownerUserId, birthdayWishId: wish.id,
        channel: "WHATSAPP", recipient: e164(wish.recipientMobile),
        subject: occasion + ", " + wish.recipientName, message,
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

async function sendWhatsApp(delivery: { recipient: string; subject: string | null; message: string; idempotencyKey: string; birthdayWishId?: string | null }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = delivery.birthdayWishId
    ? (process.env.WHATSAPP_WISH_TEMPLATE_NAME || "mhw_scheduled_wish")
    : (process.env.WHATSAPP_TEMPLATE_NAME || "mhw_reminder");
  const version = (process.env.WHATSAPP_API_VERSION || "v26.0").replaceAll("/", "");
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
  if (!token || !phoneId) {
    throw new Error("WhatsApp is not configured. Add the Meta Cloud API access token and phone number ID in Vercel.");
  }
  if (!/^v\\d+\\.\\d+$/.test(version)) {
    throw new Error("WHATSAPP_API_VERSION must look like v26.0.");
  }
  const response = await fetch("https://graph.facebook.com/" + version + "/" + phoneId + "/messages",
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
    if (!deliveries.length || deliveries.some((item) => item.status === "QUEUED" || item.status === "SENDING" || item.status === "BLOCKED")) continue;
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

function channelIsConfigured(channel: string) {
  if (channel === "EMAIL") return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  if (channel === "WHATSAPP") return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (channel === "SMS") return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  return false;
}

export async function dispatchDueNotifications() {
  const now = new Date();
  const readyChannels = (["EMAIL", "WHATSAPP", "SMS"] as const).filter(channelIsConfigured);
  if (readyChannels.length) {
    await prisma.notificationDelivery.updateMany({
      where: { status: "BLOCKED", channel: { in: [...readyChannels] } },
      data: { status: "QUEUED", nextAttemptAt: now, lastError: null },
    });
  }
  const autoReminders = await queueDueRecordReminders(now);
  const reminders = await queueDueReminders(now);
  const moneyContactReminders = await queueDueMoneyContactReminders(now);
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
      const missingProviderConfig = message.toLowerCase().includes("not configured");
      const terminal = !missingProviderConfig && attempt >= 4;
      await prisma.notificationDelivery.update({
        where: { id: item.id },
        data: {
          status: missingProviderConfig ? "BLOCKED" : terminal ? "FAILED" : "QUEUED",
          nextAttemptAt: new Date(Date.now() + (missingProviderConfig ? 24 * 60 : [5, 30, 120, 0][attempt - 1]) * 60_000),
          lastError: message,
        },
      });
      if (missingProviderConfig) retried++;
      else if (terminal) failed++;
      else retried++;
    }
  }

  await finishBirthdayWishes();
  return { autoReminders, reminders, moneyContactReminders, birthdays, attempted: queued.length, sent, retried, failed };
}
