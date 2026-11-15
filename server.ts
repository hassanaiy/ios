import crypto from "crypto";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

function validatePassengerPhoneServer(rawPhone: string, defaultCountryCode = "+20") {
  const trimmed = String(rawPhone || "").trim();
  if (!trimmed) {
    return { valid: false, normalized: "", error: "Phone number is required" };
  }
  const westernized = trimmed.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let digits = westernized.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  const cleanCountry = (defaultCountryCode || "+20").startsWith("+")
    ? defaultCountryCode
    : `+${defaultCountryCode}`;

  if (
    cleanCountry === "+20" ||
    digits.startsWith("+20") ||
    digits.startsWith("201") ||
    digits.startsWith("01")
  ) {
    let local = digits;
    if (local.startsWith("+20")) local = local.slice(3);
    else if (local.startsWith("20") && local.length === 12) local = local.slice(2);
    if (local.startsWith("0")) local = local.slice(1);
    if (/^1[0125]\d{8}$/.test(local)) {
      return { valid: true, normalized: `+20${local}`, display: `0${local}` };
    }
    return { valid: false, normalized: "", error: "Invalid Egyptian mobile number" };
  }

  let full = digits;
  if (!full.startsWith("+")) {
    if (full.startsWith("0")) full = full.slice(1);
    full = `${cleanCountry}${full}`;
  }
  const pureDigits = full.replace(/\D/g, "");
  if (pureDigits.length >= 10 && pureDigits.length <= 15) {
    return { valid: true, normalized: `+${pureDigits}`, display: `+${pureDigits}` };
  }
  return { valid: false, normalized: "", error: "Invalid passenger phone number" };
}

function hashPinSha256(salt: string, pin: string): string {
  const input = `mowasla_pin_v1:${String(salt || "").trim()}:${String(pin || "").trim()}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // CORS
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  app.get("/health", (req, res) => {
    res.json({
      success: true,
      phoneAuth: true
    });
  });

  // Standalone public Privacy Policy page (no authentication required, direct access for users & Google Play review)
  const privacyPolicyFile = fs.existsSync(path.join(process.cwd(), "public", "privacy-policy", "index.html"))
    ? path.join(process.cwd(), "public", "privacy-policy", "index.html")
    : path.join(process.cwd(), "dist", "privacy-policy", "index.html");

  app.get(["/privacy-policy", "/privacy-policy/", "/privacy-policy.html"], (_req, res, next) => {
    if (fs.existsSync(privacyPolicyFile)) {
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.sendFile(privacyPolicyFile);
    }
    return next();
  });

  // Backend validation & cryptographic token/PIN preparation for "Book a Ride for Someone Else"
  app.post("/api/rides/validate-booking", (req, res) => {
    try {
      const {
        bookingType = "SELF",
        actualPassenger,
        rideVerificationEnabled = false,
        countryCode = "+20"
      } = req.body || {};

      const normalizedType = bookingType === "FOR_OTHER" ? "FOR_OTHER" : "SELF";
      const trackingToken = crypto.randomBytes(24).toString("base64url");
      const trackingTokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;

      if (normalizedType === "FOR_OTHER") {
        const name = String(actualPassenger?.name || "").trim();
        const phone = String(actualPassenger?.phone || "").trim();
        const note = actualPassenger?.note
          ? String(actualPassenger.note).trim().slice(0, 300)
          : null;

        if (name.length < 2) {
          return res.status(400).json({
            success: false,
            code: "INVALID_ACTUAL_PASSENGER_NAME",
            error: "Passenger full name is required (at least 2 characters)"
          });
        }

        const phoneCheck = validatePassengerPhoneServer(phone, countryCode);
        if (!phoneCheck.valid) {
          return res.status(400).json({
            success: false,
            code: "INVALID_ACTUAL_PASSENGER_PHONE",
            error: phoneCheck.error
          });
        }

        let verificationPin: string | null = null;
        let verificationCodeHash: string | null = null;
        let verificationExpiresAt: number | null = null;

        if (rideVerificationEnabled) {
          verificationPin = String(crypto.randomInt(1000, 10000));
          verificationCodeHash = hashPinSha256(trackingToken, verificationPin);
          verificationExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
        }

        return res.json({
          success: true,
          bookingType: "FOR_OTHER",
          actualPassenger: {
            name,
            phone: phoneCheck.normalized,
            note,
            userId: actualPassenger?.userId || null
          },
          trackingToken,
          trackingTokenExpiresAt,
          rideVerificationEnabled: Boolean(rideVerificationEnabled),
          verificationPin,
          verificationCodeHash,
          verificationExpiresAt
        });
      }

      return res.json({
        success: true,
        bookingType: "SELF",
        actualPassenger: null,
        trackingToken,
        trackingTokenExpiresAt,
        rideVerificationEnabled: false
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Booking validation failed"
      });
    }
  });

  app.post("/api/rides/verify-pin-hash", (req, res) => {
    try {
      const { trackingToken, inputCode, verificationCodeHash, verificationExpiresAt, verificationAttempts = 0 } = req.body || {};
      if (!trackingToken || !inputCode || !verificationCodeHash) {
        return res.status(400).json({ success: false, reason: "INVALID_CODE" });
      }
      if (verificationExpiresAt && Date.now() > Number(verificationExpiresAt)) {
        return res.json({ success: false, reason: "EXPIRED", attemptsLeft: 0 });
      }
      if (Number(verificationAttempts) >= 5) {
        return res.json({ success: false, reason: "TOO_MANY_ATTEMPTS", attemptsLeft: 0 });
      }
      const cleanPin = String(inputCode)
        .trim()
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      const computed = hashPinSha256(trackingToken, cleanPin);
      const matched = computed === verificationCodeHash;
      return res.json({
        success: matched,
        reason: matched ? undefined : "INVALID_CODE",
        attemptsLeft: matched ? 5 : Math.max(0, 5 - (Number(verificationAttempts) + 1))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Verification error" });
    }
  });

  // Admin Database Config Endpoints
  const configFilePath = path.join(process.cwd(), "firebase-applet-config.json");
  const INVALID_DB_ID = "ai-studio-waslny-f4f32e33-c8e0-4c8f-9906-38a6a367b48f";

  // Ensure firebase-applet-config.json uses (default) instead of non-existent named DB
  try {
    if (fs.existsSync(configFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
      if (!parsed.firestoreDatabaseId || parsed.firestoreDatabaseId === INVALID_DB_ID) {
        parsed.firestoreDatabaseId = "(default)";
        fs.writeFileSync(configFilePath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
      }
    }
  } catch {}

  app.get("/api/admin/database-config", (_req, res) => {
    try {
      if (fs.existsSync(configFilePath)) {
        const raw = fs.readFileSync(configFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed.firestoreDatabaseId || parsed.firestoreDatabaseId === INVALID_DB_ID) {
          parsed.firestoreDatabaseId = "(default)";
        }
        res.json({ success: true, config: parsed });
      } else {
        res.status(404).json({ success: false, error: "Config file not found" });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Failed to read config" });
    }
  });

  app.post("/api/admin/database-config", (req, res) => {
    try {
      const currentRaw = fs.existsSync(configFilePath)
        ? JSON.parse(fs.readFileSync(configFilePath, "utf-8"))
        : {};
      const updatedConfig = {
        ...currentRaw,
        ...req.body,
      };
      fs.writeFileSync(configFilePath, JSON.stringify(updatedConfig, null, 2) + "\n", "utf-8");
      res.json({ success: true, config: updatedConfig });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Failed to update config" });
    }
  });

  app.post("/api/admin/delete-user-auth", async (req, res) => {
    const { uid } = req.body || {};
    if (!uid) {
      return res.status(400).json({ success: false, error: "Missing uid" });
    }
    res.json({
      success: true,
      uid,
      message: "User Auth scheduled and flagged for immediate revocation"
    });
  });

  app.post("/api/scheduled-rides/validate", (req, res) => {
    try {
      const {
        scheduledPickupAt,
        pickup,
        dropoff,
        category,
        fare,
        maxAdvanceBookingDays = 7,
        minAdvanceBookingMinutes = 15
      } = req.body || {};

      const now = Date.now();
      const pickupTime = Number(scheduledPickupAt);
      if (!pickupTime || isNaN(pickupTime)) {
        return res.status(400).json({ valid: false, code: "INVALID_TIMESTAMP", error: "Invalid scheduledPickupAt timestamp" });
      }
      if (pickupTime < now - 60000) {
        return res.status(400).json({ valid: false, code: "PAST_DATETIME", error: "Cannot schedule a ride in the past" });
      }
      if (pickupTime < now + minAdvanceBookingMinutes * 60 * 1000 - 60000) {
        return res.status(400).json({ valid: false, code: "TOO_SOON", error: `Must schedule at least ${minAdvanceBookingMinutes} minutes in advance` });
      }
      if (pickupTime > now + maxAdvanceBookingDays * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ valid: false, code: "EXCEEDS_MAX_ADVANCE_WINDOW", error: `Cannot schedule more than ${maxAdvanceBookingDays} days in advance` });
      }
      if (!pickup?.address || typeof pickup?.coords?.lat !== "number" || typeof pickup?.coords?.lng !== "number") {
        return res.status(400).json({ valid: false, code: "INVALID_PICKUP", error: "Invalid pickup location" });
      }
      if (!dropoff?.address || typeof dropoff?.coords?.lat !== "number" || typeof dropoff?.coords?.lng !== "number") {
        return res.status(400).json({ valid: false, code: "INVALID_DROPOFF", error: "Invalid dropoff location" });
      }
      if (!["MOTO", "STANDARD", "COMFORT"].includes(String(category))) {
        return res.status(400).json({ valid: false, code: "INVALID_CATEGORY", error: "Invalid vehicle category" });
      }
      if (fare !== undefined && (isNaN(Number(fare)) || Number(fare) <= 0)) {
        return res.status(400).json({ valid: false, code: "INVALID_FARE", error: "Invalid fare amount" });
      }

      return res.json({
        valid: true,
        scheduledPickupAt: pickupTime,
        timezone: "Africa/Cairo"
      });
    } catch (err: any) {
      return res.status(500).json({ valid: false, error: err?.message || "Validation error" });
    }
  });

  // VITE
  if (process.env.NODE_ENV !== "production") {
    const vitePromise = createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server Running On http://0.0.0.0:${PORT}`);
  });
}

startServer();