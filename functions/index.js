
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler"); 
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();


const checkIsAdminSync = (context) => {
    if (!context || !context.auth || !context.auth.token) return false;
    const email = (context.auth.token.email || "").toLowerCase().trim();
    const phone = (context.auth.token.phone_number || "").replace(/\D/g, "");
    return (
        email === "wondersco@gmail.com" ||
        email === "wonderscoco10@gmail.com" ||
        email.includes("admin") ||
        phone === "201024419931" ||
        phone === "01024419931" ||
        phone.endsWith("1024419931") ||
        Boolean(context.auth.token.admin)
    );
};

const isAdmin = async (context) => {
    if (checkIsAdminSync(context)) return true;
    if (!context || !context.auth || !context.auth.uid) return false;
    try {
        const uSnap = await db.collection("users").doc(context.auth.uid).get();
        if (uSnap.exists) {
            const data = uSnap.data();
            return data.role === "ADMIN" || data.isAdmin === true;
        }
    } catch (_) {}
    return false;
};

/* =====================================================
   CRON JOB: Check Expired Trials & Reminders
===================================================== */
exports.checkExpiredTrials = onSchedule("every 1 hours", async (event) => {
    const now = Date.now();
    
    // 1. Check and Expire
    const snapshot = await db.collection("users")
        .where("isTrialActive", "==", true)
        .where("trialEndDate", "<=", now)
        .get();

    if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { 
                isTrialActive: false, 
                hasTrialExpired: true 
            });
            const token = doc.data().fcmToken;
            if (token) {
               admin.messaging().send({
                   token: token,
                   notification: {
                       title: "Free Trial Ended",
                       body: "Your free commission period has ended. Regular commission will now apply."
                   }
               }).catch(() => {});
            }
        });
        await batch.commit();
        console.log(`Expired ${snapshot.size} free trials.`);
    }

    // 2. Send Reminders (Approximate matching since it runs hourly)
    // We check if trialEndDate is between (Target - 1hr) and Target
    const hourMs = 60 * 60 * 1000;
    const sendReminders = async (daysLeft) => {
        const targetTime = now + (daysLeft * 24 * 60 * 60 * 1000);
        const reminderSnap = await db.collection("users")
            .where("isTrialActive", "==", true)
            .where("trialEndDate", ">", targetTime - hourMs)
            .where("trialEndDate", "<=", targetTime)
            .get();
            
        reminderSnap.docs.forEach(doc => {
            const token = doc.data().fcmToken;
            if (token) {
               admin.messaging().send({
                   token: token,
                   notification: {
                       title: "Free Trial Ending Soon",
                       body: `Your free commission trial will end in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`
                   }
               }).catch(() => {});
            }
        });
    };
    
    await sendReminders(7);
    await sendReminders(3);
    await sendReminders(1);
});

/* =====================================================
   AUTH SYNC (NATIVE -> WEB)
===================================================== */
exports.exchangeNativeAuthToken = onCall({ cors: true }, async (request) => {
    const { idToken } = request.data;
    if (!idToken) throw new HttpsError('invalid-argument', 'Missing ID Token');
    try {
        // Verify the Native ID Token
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid;
        
        // Create a Custom Token for the JS SDK
        const customToken = await admin.auth().createCustomToken(uid);
        return { customToken };
    } catch (e) {
        console.error("Token Exchange Error", e);
        throw new HttpsError('unauthenticated', 'Invalid token');
    }
});

/* =====================================================
   CORE LOGIC (CLEANUP & NOTIFICATIONS)
===================================================== */

exports.cleanupExpiredRides = onSchedule("every 1 minutes", async (event) => {
    const now = Date.now();
    // Target rides that haven't been accepted for 10 minutes
    const timeoutThreshold = now - 600000; // 10 minutes (600,000 ms)
    
    // Statuses that qualify as "pending/no action"
    const pendingStatuses = ['SEARCHING', 'OFFER_RECEIVED'];
    
    const ridesRef = db.collection('rides');
    
    // Query for rides older than 10 mins in pending state
    // Note: This requires a composite index on status + timestamp
    const expiredRidesQuery = ridesRef.where('status', 'in', pendingStatuses).where('timestamp', '<', timeoutThreshold);
    
    const snapshot = await expiredRidesQuery.get();
    if (snapshot.empty) return null;

    console.log(`Found ${snapshot.size} expired rides to clean up.`);

    const results = [];
    for (const doc of snapshot.docs) {
        const rideId = doc.id;
        const rideData = doc.data();

        // Do not prematurely cancel a scheduled ride unless its scheduledPickupAt + maxDispatchDurationMinutes has elapsed
        if (rideData.isScheduled || rideData.scheduledPickupAt || rideData.scheduledTime) {
            const pickupAt = Number(rideData.scheduledPickupAt || rideData.scheduledTime || 0);
            const maxGraceMs = 30 * 60 * 1000;
            if (pickupAt > 0 && now < pickupAt + maxGraceMs) {
                continue;
            }
        }
        
        // 1. Cancel the ride
        const updateTask = doc.ref.update({ 
            status: 'CANCELLED', 
            cancelledBy: 'system',
            cancelReason: 'Inactivity timeout (10 mins)',
            closedAt: admin.firestore.FieldValue.serverTimestamp() 
        });

        // 2. Add system chat message explaining the reason
        const msgEn = "Trip cancelled by system due to no action or connection issues.";
        const msgAr = "تم إلغاء الرحلة تلقائياً لعدم وجود استجابة أو لضعف الاتصال بالإنترنت.";
        
        const messageTask = ridesRef.doc(rideId).collection('messages').add({
            senderId: 'system',
            text: msgAr, // Defaulting to Arabic per requirement
            text_en: msgEn,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isSystem: true
        });

        // 3. Notify the passenger if token exists
        let notifyTask = Promise.resolve();
        if (rideData.passengerId) {
            const userDoc = await db.collection("users").doc(rideData.passengerId).get();
            const token = userDoc.data()?.fcmToken;
            if (token) {
                notifyTask = admin.messaging().send({
                    notification: {
                        title: "تنبيه النظام ⚠️",
                        body: "تم إلغاء طلبك تلقائياً لعدم العثور على سائق في خلال ١٠ دقائق."
                    },
                    data: { type: "SYSTEM_CANCEL", rideId: rideId },
                    token: token
                }).catch(e => console.error("FCM System Cancel Error", e));
            }
        }

        results.push(Promise.all([updateTask, messageTask, notifyTask]));
    }
    
    await Promise.all(results);
    console.log(`System cleaned up ${snapshot.size} expired trips.`);
    return null;
});

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; var dLat = deg2rad(lat2 - lat1); var dLon = deg2rad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function deg2rad(deg) { return deg * (Math.PI / 180); }

async function notifyNearbyDrivers(ride) {
    if (!ride || !ride.pickup?.coords) return [];
    const searchRadiusKm = Math.max(Number(ride.searchRadiusKm) || 20, 15);
    const previouslyNotified = ride.notifiedDriverIds || [];

    // Query online drivers (avoiding compound index restrictions on multiple equals)
    const driversSnapshot = await db.collection("users")
        .where("role", "==", "DRIVER")
        .where("isOnline", "==", true)
        .get();

    if (driversSnapshot.empty) return [];
    const eligibleDrivers = [];

    driversSnapshot.forEach(doc => {
        const driver = { id: doc.id, ...doc.data() };
        if (previouslyNotified.includes(driver.id)) return;

        // Support various approved status flag conventions in Firestore
        const isApproved = driver.status === "approved" || 
                           driver.driverStatus === "approved" || 
                           driver.isApproved === true || 
                           driver.kycStatus === "APPROVED";
        if (!isApproved) return;

        if (!driver.currentLocation || !driver.fcmToken) return;

        const maxRadius = Math.max(Number(driver.searchRadius) || 50, 15);
        const distance = getDistanceFromLatLonInKm(
            ride.pickup.coords.lat,
            ride.pickup.coords.lng,
            driver.currentLocation.lat,
            driver.currentLocation.lng
        );

        if (distance <= searchRadiusKm && distance <= maxRadius) {
            eligibleDrivers.push(driver);
        }
    });

    if (eligibleDrivers.length === 0) return [];

    const notifiedIds = eligibleDrivers.map(d => d.id);
    const tokens = eligibleDrivers
        .map(d => d.fcmToken)
        .filter(t => t && typeof t === "string" && !t.startsWith("web_mock_") && t.length > 20);

    if (tokens.length === 0) return notifiedIds;

    const isParcel = ride.rideType === 'PARCEL';
    const title = isParcel ? "طلب توصيل طرد! 📦" : "طلب رحلة جديد! 🚗";
    const addressStr = ride.pickup?.address || "موقع محدد";
    const fareStr = String(ride.fare || ride.price || 0);
    const body = `من: ${addressStr.substring(0, 50)}... | الأجرة: ${fareStr} ج.م`;

    try {
        await admin.messaging().sendEachForMulticast({
            data: {
                type: "NEW_RIDE_REQUEST",
                rideId: String(ride.id || ""),
                title: String(title),
                body: String(body),
                fare: fareStr,
                pickupAddress: String(addressStr)
            },
            notification: { title, body },
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    channelId: "ride_requests",
                    clickAction: "FLUTTER_NOTIFICATION_CLICK"
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1
                    }
                }
            },
            webpush: {
                notification: {
                    title,
                    body,
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                    tag: `ride_${ride.id}`,
                    renotify: true,
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: "/"
                }
            },
            tokens
        });
        console.log(`Successfully sent trip push notifications to ${tokens.length} drivers.`);
    } catch (fcmError) {
        console.error("FCM SendEachForMulticast Error for trip request:", fcmError);
    }

    return notifiedIds;
}

// Consolidated into notifyDriverOnApprovalStatusChange below to prevent duplicate pushes
// on conflicting channels while keeping the exported function name deploy-safe.
exports.onDriverStatusUpdate = onDocumentUpdated("users/{userId}", async () => {
    return null;
});

exports.onNewRideRequest = onDocumentCreated("rides/{rideId}", async (event) => {
    const rideData = event.data.data();
    if (!rideData || rideData.status !== 'SEARCHING') return;
    const notifiedIds = await notifyNearbyDrivers({ id: event.params.rideId, ...rideData });
    if (notifiedIds.length > 0) await db.collection("rides").doc(event.params.rideId).update({ notifiedDriverIds: admin.firestore.FieldValue.arrayUnion(...notifiedIds) });
});

exports.onRideSearchUpdate = onDocumentUpdated("rides/{rideId}", async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    if ((afterData.status === 'SEARCHING' || afterData.status === 'OFFER_RECEIVED') && beforeData.searchRadiusKm !== afterData.searchRadiusKm) {
        const newlyNotifiedIds = await notifyNearbyDrivers({ id: event.params.rideId, ...afterData });
        if (newlyNotifiedIds.length > 0) await db.collection("rides").doc(event.params.rideId).update({ notifiedDriverIds: admin.firestore.FieldValue.arrayUnion(...newlyNotifiedIds) });
    }
});

exports.sendOfferNotification = onDocumentCreated("rides/{rideId}/offers/{offerId}", async (event) => {
    try {
        const rideDoc = await db.collection("rides").doc(event.params.rideId).get();
        if (!rideDoc.exists) return;
        const userDoc = await db.collection("users").doc(rideDoc.data().passengerId).get();
        if (userDoc.data()?.fcmToken) {
            await admin.messaging().send({ 
                notification: { 
                    title: "عرض سعر جديد! 💰", 
                    body: `سائق يقدم عرضاً بقيمة ${event.data.data().price} ج.م` 
                }, 
                data: {
                    type: "OFFER_RECEIVED",
                    rideId: event.params.rideId,
                    offerId: event.params.offerId
                },
                android: { 
                    priority: "high", 
                    notification: { sound: "default", channelId: "offers" } 
                }, 
                apns: { 
                    payload: { aps: { sound: "default" } } 
                }, 
                token: userDoc.data().fcmToken 
            });
        }
    } catch (e) { console.error("sendOfferNotification FCM error:", e); }
});

exports.notifyDriverOnCounterOffer = onDocumentUpdated("rides/{rideId}/offers/{offerId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    // Check if a counter offer was just added
    if (newData.status === 'countered' && oldData.status !== 'countered') {
        const { driverId, passengerCounterPrice } = newData;
        const rideId = event.params.rideId;
        const offerId = event.params.offerId;
        
        const driverDoc = await db.collection("users").doc(driverId).get();
        if (!driverDoc.exists() || !driverDoc.data().fcmToken) {
            console.log(`Driver ${driverId} not found or has no token.`);
            return;
        }
        
        const rideDoc = await db.collection("rides").doc(rideId).get();
        const passengerName = rideDoc.data()?.passengerName || "A passenger";

        const token = driverDoc.data().fcmToken;
        const title = `💰 عرض مضاد من ${passengerName}!`;
        const body = `عرض جديد: ${passengerCounterPrice} ج.م. اضغط للمراجعة.`;

        try {
            await admin.messaging().send({
                notification: { title, body },
                data: {
                    type: "COUNTER_OFFER",
                    rideId: rideId,
                    offerId: offerId,
                    price: String(passengerCounterPrice)
                },
                token: token,
                android: { priority: "high", notification: { sound: "default", channelId: "offers" } },
                apns: { payload: { aps: { sound: "default" } } },
            });
            console.log(`Sent counter offer notification to driver ${driverId}`);
        } catch(e) {
            console.error("FCM counter offer error", e);
        }
    }
});

exports.notifyDriverOnOfferUpdate = onDocumentUpdated("rides/{rideId}/offers/{offerId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    if (oldData.status !== "rejected" && newData.status === "rejected") {
        const driverDoc = await db.collection("users").doc(newData.driverId).get();
        if (driverDoc.exists && driverDoc.data().fcmToken) await admin.messaging().send({ notification: { title: "تم رفض العرض ❌", body: "Your offer was refused. You can submit a new price now." }, android: { priority: "high", notification: { sound: "default", channelId: "offers" } }, apns: { payload: { aps: { sound: "default" } } }, token: driverDoc.data().fcmToken });
    }
});

exports.aggregateRatings = onDocumentCreated("reviews/{reviewId}", async (event) => {
    const { targetUserId, rating } = event.data.data();
    if (!targetUserId || typeof rating !== "number") return null;
    const userRef = db.collection("users").doc(targetUserId);
    await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) return;
        const { rating: currentRating = 0, totalRatings = 0 } = userDoc.data();
        const newTotalRatings = totalRatings + 1;
        const newRating = ((currentRating * totalRatings) + rating) / newTotalRatings;
        t.update(userRef, { rating: newRating, totalRatings: newTotalRatings });
    });
});

exports.triggerSOS = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const { rideId, location, userRole } = request.data;
    const rideRef = db.collection("rides").doc(rideId);
    await rideRef.update({ sosEvent: { triggeredBy: userRole, location: new admin.firestore.GeoPoint(location.lat, location.lng), timestamp: admin.firestore.FieldValue.serverTimestamp() } });
    return { success: true };
});

const ADMIN_EMAILS_SET = new Set(["wondersco@gmail.com", "wonderscoco10@gmail.com"]);

function isUserDocAdmin(userData) {
    if (!userData) return false;
    if (userData.role === "ADMIN" || userData.isAdmin === true) return true;
    const email = String(userData.email || "").toLowerCase().trim();
    if (ADMIN_EMAILS_SET.has(email)) return true;
    const phoneDigits = String(userData.phone || "").replace(/\D/g, "");
    if (!email && phoneDigits && (phoneDigits === "201024419931" || phoneDigits === "01024419931" || phoneDigits.endsWith("1024419931"))) {
        return true;
    }
    return false;
}

function isValidFcmToken(token) {
    return Boolean(token && typeof token === "string" && !token.startsWith("web_mock_") && token.trim().length > 20);
}

async function dispatchSystemMulticast({
    title,
    body,
    dataPayload = {},
    audience = "all",
    targetPlatform = "android",
}) {
    const usersSnapshot = await db.collection("users").where("fcmToken", "!=", null).get();
    const targets = [];

    usersSnapshot.forEach((uDoc) => {
        const u = uDoc.data() || {};
        // Strictly exclude Admin accounts from all system/update notifications
        if (isUserDocAdmin(u)) return;

        // Strictly target Android / Native app users when targetPlatform is 'android'
        const platform = String(u.fcmPlatform || "").toLowerCase().trim();
        if (targetPlatform === "android" && platform === "web") return;

        if (audience === "drivers") {
            const isDriver =
                u.role === "DRIVER" ||
                u.driverStatus === "approved" ||
                u.isApproved === true ||
                u.kycStatus === "APPROVED";
            if (!isDriver) return;
        } else if (audience === "passengers") {
            if (u.role !== "PASSENGER") return;
        }

        if (!isValidFcmToken(u.fcmToken)) return;
        targets.push({ uid: uDoc.id, token: u.fcmToken });
    });

    if (targets.length === 0) {
        return { success: true, sentCount: 0, failedCount: 0, totalTargets: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i += 500) {
        const chunk = targets.slice(i, i + 500);
        const tokens = chunk.map((t) => t.token);
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: String(title),
                body: String(body),
            },
            data: dataPayload,
            android: {
                priority: "high",
                notification: {
                    channelId: "admin_alerts",
                    sound: "default",
                    priority: "high",
                    defaultVibrateTimings: true,
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                    },
                },
            },
        });
        successCount += response.successCount;
        failedCount += response.failureCount;

        // Clean up unregistered/invalid tokens asynchronously
        response.responses.forEach((res, idx) => {
            if (!res.success && res.error) {
                clearStaleFcmTokenIfUnchanged(chunk[idx].uid, chunk[idx].token, res.error).catch(() => {});
            }
        });
    }

    return {
        success: true,
        sentCount: successCount,
        failedCount,
        totalTargets: targets.length,
    };
}

exports.sendBroadcastNotification = onCall({ cors: true }, async (request) => {
    if (!(await isAdmin(request))) throw new HttpsError("permission-denied", "Unauthorized.");
    const { title, body } = request.data || {};
    if (!title || !body) throw new HttpsError("invalid-argument", "Title and body are required.");
    return await dispatchSystemMulticast({
        title,
        body,
        audience: "all",
        targetPlatform: "android",
        dataPayload: {
            type: "SYSTEM_BROADCAST",
            title: String(title),
            body: String(body),
        },
    });
});

exports.sendSystemBroadcastPush = onCall({ cors: true }, async (request) => {
    if (!(await isAdmin(request))) throw new HttpsError("permission-denied", "Unauthorized.");
    const {
        title,
        body,
        titleAr,
        bodyAr,
        type = "alert",
        audience = "all",
        targetPlatform = "android",
        playStoreUrl = "https://play.google.com/store/apps/details?id=com.ans.waslny",
        broadcastId = "",
        requiredVersion = "",
    } = request.data || {};

    const resolvedTitle = String(title || titleAr || "Mowasla Update").trim();
    const resolvedBody = String(body || bodyAr || "").trim();
    if (!resolvedTitle || !resolvedBody) {
        throw new HttpsError("invalid-argument", "Title and body are required.");
    }

    const isUpdateType = type === "update" || type === "Forced Update" || type === "SYSTEM_UPDATE" || type === "FORCE_UPDATE";

    return await dispatchSystemMulticast({
        title: resolvedTitle,
        body: resolvedBody,
        audience,
        targetPlatform,
        dataPayload: {
            type: isUpdateType ? "SYSTEM_UPDATE" : "SYSTEM_BROADCAST",
            broadcastType: String(type),
            broadcastId: String(broadcastId || ""),
            requiredVersion: String(requiredVersion || ""),
            playStoreUrl: String(playStoreUrl || "https://play.google.com/store/apps/details?id=com.ans.waslny"),
            title: resolvedTitle,
            body: resolvedBody,
        },
    });
});

async function clearStaleFcmTokenIfUnchanged(userId, failedToken, err) {
    const code = err?.code || "";
    if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
    ) {
        try {
            const uRef = db.collection("users").doc(userId);
            const snap = await uRef.get();
            if (snap.exists && snap.data()?.fcmToken === failedToken) {
                await uRef.update({ fcmToken: null });
                console.warn(`[Push Notification] Cleared stale/unregistered FCM token for user ${userId}`);
            }
        } catch (_) {}
    }
}

async function claimNotificationDispatch(userId, eventId, notifPayload) {
    if (!eventId) return true;
    const notifRef = db.collection("users").doc(userId).collection("notifications").doc(String(eventId));
    return await db.runTransaction(async (t) => {
        const snap = await t.get(notifRef);
        if (snap.exists && snap.data()?.fcmDispatched === true) {
            return false;
        }
        t.set(notifRef, {
            ...notifPayload,
            fcmDispatched: true,
            fcmDispatchedAt: Date.now()
        }, { merge: true });
        return true;
    });
}

exports.sendTargetedNotification = onCall({ cors: true }, async (request) => {
    // Only admins can send arbitrary notifications to specific users
    if (!(await isAdmin(request))) throw new HttpsError("permission-denied", "Unauthorized.");
    const { userId, title, body, data, eventId } = request.data || {};
    if (!userId || !title || !body) throw new HttpsError("invalid-argument", "Missing required fields.");
    
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) throw new HttpsError("not-found", "User not found.");

    const notifType = data?.type || "TARGETED_NOTIFICATION";
    const resolvedEventId = eventId || data?.eventId || null;

    if (resolvedEventId) {
        const claimed = await claimNotificationDispatch(userId, resolvedEventId, {
            title,
            body,
            type: notifType,
            data: data || {},
            timestamp: Date.now(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        }).catch(() => true);

        if (!claimed) {
            return { success: true, deduplicated: true };
        }
    } else {
        try {
            await db.collection("users").doc(userId).collection("notifications").add({
                title,
                body,
                type: notifType,
                data: data || {},
                timestamp: Date.now(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                fcmDispatched: true
            });
        } catch (_dbErr) {}
    }
    
    const token = userDoc.data()?.fcmToken;
    if (!isValidFcmToken(token)) {
        return { success: false, reason: "No valid FCM token for user" };
    }

    const stringData = {
        title: String(title),
        body: String(body),
    };
    if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
            stringData[k] = String(v ?? '');
        }
    }

    try {
        await admin.messaging().send({
            token,
            notification: { title, body },
            data: stringData,
            android: { 
                priority: "high", 
                notification: { 
                    sound: "default", 
                    channelId: "push_notifications_audio2",
                    priority: "high",
                    defaultVibrateTimings: true,
                    tag: String(notifType)
                } 
            },
            apns: { 
                payload: { 
                    aps: { 
                        sound: "default",
                        badge: 1,
                        contentAvailable: true
                    } 
                } 
            },
            webpush: {
                headers: {
                    Urgency: "high"
                },
                notification: {
                    title,
                    body,
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                    tag: `${notifType}_${userId}`,
                    renotify: true,
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: "/"
                }
            }
        });
        return { success: true };
    } catch (error) {
        console.error("sendTargetedNotification Error:", error);
        await clearStaleFcmTokenIfUnchanged(userId, token, error);
        return { success: false, reason: error?.message || "FCM send failed" };
    }
});

exports.notifyChatOnNewMessage = onDocumentCreated("rides/{rideId}/messages/{messageId}", async (event) => {
    const messageData = event.data.data();
    if (!messageData || messageData.isSystem) return;

    const rideDoc = await db.collection("rides").doc(event.params.rideId).get();
    if (!rideDoc.exists) return;
    const rideData = rideDoc.data();
    
    const senderId = messageData.senderId;
    const recipientId = (senderId === rideData.passengerId) ? rideData.driverId : rideData.passengerId;
    
    if (!recipientId) return;
    
    const userDoc = await db.collection("users").doc(recipientId).get();
    if (!userDoc.exists) return;
    const token = userDoc.data()?.fcmToken;
    if (!token) return;

    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = senderDoc.exists ? (senderDoc.data().name || "رسالة جديدة") : "رسالة جديدة";

    try {
        await admin.messaging().send({
            notification: {
                title: senderName + " 💬",
                body: messageData.text || "تم إرسال رسالة جديدة"
            },
            data: {
                type: "CHAT_MESSAGE",
                rideId: event.params.rideId,
                senderId: senderId
            },
            android: { priority: "high", notification: { sound: "default", channelId: "chat" } },
            apns: { payload: { aps: { sound: "default" } } },
            token: token
        });
    } catch(e) {
        console.error("FCM Chat Notification error", e);
    }
});

exports.notifyPassengerOnRideStatusUpdate = onDocumentUpdated("rides/{rideId}", async (event) => {
    const oldData = event.data.before.data();
    const newData = event.data.after.data();

    if (oldData.status !== newData.status) {
        const ownerId = newData.bookedBy?.userId || newData.passengerId;
        if (!ownerId) return;

        const isForOther = newData.bookingType === "FOR_OTHER" && Boolean(newData.actualPassenger?.name);
        const paxName = isForOther ? newData.actualPassenger.name : "";

        let ownerTitle = "";
        let ownerBody = "";
        let actualPaxTitle = "";
        let actualPaxBody = "";

        if (newData.status === "ACCEPTED") {
            ownerTitle = isForOther ? `الكابتن في الطريق إلى ${paxName} 🚗` : "السائق في الطريق 🚗";
            ownerBody = isForOther
                ? `تم قبول الرحلة المحجوزة لـ ${paxName}. يمكنك الآن مشاركة رابط تتبع الرحلة المباشر معه.`
                : "تم قبول طلبك، السائق في طريقه إليك.";
            actualPaxTitle = "تم تعيين كابتن لرحلتك 🚗";
            actualPaxBody = `الكابتن في طريقه لنقطة الاستلام الخاصة بك (${newData.pickup?.address || ""}).`;
        } else if (newData.status === "ARRIVED") {
            ownerTitle = isForOther ? `وصل الكابتن لنقطة استلام ${paxName} 📍` : "السائق وصل 📍";
            ownerBody = isForOther
                ? `الكابتن وصل وينتظر ${paxName} عند نقطة الانطلاق.`
                : "تفضل بالنزول، السائق في انتظارك بالخارج.";
            actualPaxTitle = "الكابتن وصل لنقطة الاستلام 📍";
            actualPaxBody = "تفضل بالنزول، الكابتن في انتظارك الآن.";
        } else if (newData.status === "IN_PROGRESS") {
            ownerTitle = isForOther ? `بدأت رحلة ${paxName} 🚀` : "بدأت الرحلة 🚀";
            ownerBody = isForOther
                ? `انطلقت رحلة ${paxName} الآن باتجاه ${newData.dropoff?.address || "الوجهة"}.`
                : "نتمنى لك رحلة آمنة.";
            actualPaxTitle = "بدأت رحلتك 🚀";
            actualPaxBody = "نتمنى لك رحلة آمنة مع مواصلة.";
        } else if (newData.status === "COMPLETED") {
            ownerTitle = isForOther ? `وصل ${paxName} إلى وجهته بسلام ✅` : "اكتملت الرحلة ✅";
            ownerBody = isForOther
                ? `اكتملت رحلة ${paxName} بنجاح. شكراً لاستخدامك مواصلة!`
                : "شكراً لركوبك معنا، لا تنسى تقييم السائق.";
            actualPaxTitle = "الحمد لله على السلامة ✅";
            actualPaxBody = "اكتملت رحلتك بنجاح.";
        } else if (newData.status === "CANCELLED") {
            ownerTitle = isForOther ? `تم إلغاء رحلة ${paxName} ⚠️` : "تم إلغاء الرحلة ⚠️";
            ownerBody = isForOther
                ? `تم إلغاء الرحلة المحجوزة لـ ${paxName}.`
                : "تم إلغاء الرحلة.";
            actualPaxTitle = "تم إلغاء الرحلة ⚠️";
            actualPaxBody = "تم إلغاء الرحلة المحجوزة لك.";
        }

        // 1. Notify booking owner
        if (ownerTitle && ownerBody) {
            try {
                await db.collection("users").doc(ownerId).collection("notifications").add({
                    type: "RIDE_STATUS_UPDATE",
                    rideId: event.params.rideId,
                    status: newData.status,
                    bookingType: newData.bookingType || "SELF",
                    title: ownerTitle,
                    body: ownerBody,
                    timestamp: Date.now(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false
                }).catch(() => {});

                const ownerDoc = await db.collection("users").doc(ownerId).get();
                const ownerToken = ownerDoc.exists ? ownerDoc.data()?.fcmToken : null;
                if (ownerToken) {
                    await admin.messaging().send({
                        notification: { title: ownerTitle, body: ownerBody },
                        data: {
                            type: "RIDE_STATUS_UPDATE",
                            rideId: String(event.params.rideId),
                            status: String(newData.status),
                            bookingType: String(newData.bookingType || "SELF")
                        },
                        android: { priority: "high", notification: { sound: "default", channelId: "ride_status" } },
                        apns: { payload: { aps: { sound: "default" } } },
                        token: ownerToken
                    });
                }
            } catch (e) {
                console.error("FCM Booking Owner Status Notification error", e);
            }
        }

        // 2. Notify actual passenger if they have a distinct Mowasla user account
        const actualPaxUserId = isForOther ? newData.actualPassenger?.userId : null;
        if (actualPaxUserId && actualPaxUserId !== ownerId && actualPaxTitle && actualPaxBody) {
            try {
                await db.collection("users").doc(actualPaxUserId).collection("notifications").add({
                    type: "RIDE_STATUS_UPDATE",
                    rideId: event.params.rideId,
                    status: newData.status,
                    bookingType: "FOR_OTHER",
                    title: actualPaxTitle,
                    body: actualPaxBody,
                    timestamp: Date.now(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false
                }).catch(() => {});

                const paxDoc = await db.collection("users").doc(actualPaxUserId).get();
                const paxToken = paxDoc.exists ? paxDoc.data()?.fcmToken : null;
                if (paxToken) {
                    await admin.messaging().send({
                        notification: { title: actualPaxTitle, body: actualPaxBody },
                        data: {
                            type: "RIDE_STATUS_UPDATE",
                            rideId: String(event.params.rideId),
                            status: String(newData.status),
                            bookingType: "FOR_OTHER"
                        },
                        android: { priority: "high", notification: { sound: "default", channelId: "ride_status" } },
                        apns: { payload: { aps: { sound: "default" } } },
                        token: paxToken
                    });
                }
            } catch (e) {
                console.error("FCM Actual Passenger Status Notification error", e);
            }
        }
    }
});

exports.verifyRideStartPin = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    const { rideId, inputCode } = request.data || {};
    if (!rideId || !inputCode) {
        throw new HttpsError("invalid-argument", "rideId and inputCode are required.");
    }
    const crypto = require("crypto");
    const cleanCode = String(inputCode)
        .trim()
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const rideRef = db.collection("rides").doc(rideId);

    return await db.runTransaction(async (t) => {
        const snap = await t.get(rideRef);
        if (!snap.exists) {
            return { success: false, reason: "NOT_FOUND" };
        }
        const rData = snap.data();
        if (rData.driverId && rData.driverId !== request.auth.uid) {
            throw new HttpsError("permission-denied", "Only the assigned driver can verify the ride code.");
        }
        if (!rData.rideVerificationEnabled || rData.verificationVerified) {
            return { success: true };
        }
        if (rData.verificationExpiresAt && Date.now() > Number(rData.verificationExpiresAt)) {
            return { success: false, reason: "EXPIRED", attemptsLeft: 0 };
        }
        const attempts = Number(rData.verificationAttempts || 0);
        if (attempts >= 5) {
            return { success: false, reason: "TOO_MANY_ATTEMPTS", attemptsLeft: 0 };
        }
        const expectedHash = crypto
            .createHash("sha256")
            .update(`mowasla_pin_v1:${String(rData.trackingToken || "").trim()}:${cleanCode}`, "utf8")
            .digest("hex");
        if (rData.verificationCodeHash && expectedHash === rData.verificationCodeHash) {
            t.update(rideRef, {
                verificationVerified: true,
                verificationVerifiedAt: Date.now(),
                verificationCodeHash: null
            });
            return { success: true };
        }
        const nextAttempts = attempts + 1;
        t.update(rideRef, { verificationAttempts: nextAttempts });
        return {
            success: false,
            reason: nextAttempts >= 5 ? "TOO_MANY_ATTEMPTS" : "INVALID_CODE",
            attemptsLeft: Math.max(0, 5 - nextAttempts)
        };
    });
});

exports.getPublicRideTracking = onCall({ cors: true }, async (request) => {
    const { rideIdOrToken, token } = request.data || {};
    if (!rideIdOrToken) {
        throw new HttpsError("invalid-argument", "Missing tracking identifier");
    }
    let rideDoc = await db.collection("rides").doc(String(rideIdOrToken)).get();
    if (!rideDoc.exists) {
        const qSnap = await db.collection("rides")
            .where("trackingToken", "==", String(rideIdOrToken))
            .limit(1)
            .get();
        if (qSnap.empty) {
            return { found: false, invalidToken: true };
        }
        rideDoc = qSnap.docs[0];
    }
    const rData = rideDoc.data();
    if (token && rData.trackingToken && rData.trackingToken !== token) {
        return { found: false, invalidToken: true };
    }
    const isTerminal = ["COMPLETED", "CANCELLED", "EXPIRED"].includes(rData.status);
    const isExpired = Boolean(rData.trackingTokenExpiresAt && Date.now() > Number(rData.trackingTokenExpiresAt));

    let driverInfo = null;
    if (rData.driverId) {
        const dSnap = await db.collection("users").doc(rData.driverId).get();
        if (dSnap.exists) {
            const d = dSnap.data();
            driverInfo = {
                name: d.name || "Captain",
                avatar: d.avatar || d.personalPhotoUrl || null,
                rating: d.rating || 5.0,
                isVerified: Boolean(d.isVerified || d.status === "approved"),
                vehicleBrand: d.vehicleBrand || "",
                vehicleModel: d.vehicleModel || "",
                vehicleColor: d.vehicleColor || "",
                vehiclePlate: d.vehiclePlate || "",
                vehicleImageUrl: d.vehicleImageUrl || null
            };
        }
    }

    return {
        found: true,
        expired: isExpired,
        invalidToken: false,
        ride: {
            id: rideDoc.id,
            status: rData.status,
            pickup: rData.pickup,
            dropoff: rData.dropoff,
            fare: rData.fare,
            bookingType: rData.bookingType || "SELF",
            actualPassengerName: rData.actualPassenger?.name || rData.passengerName || null,
            driverLocation: isTerminal || isExpired ? null : (rData.driverLocation || null),
            driverHeading: isTerminal || isExpired ? 0 : (rData.driverHeading || 0),
            driver: driverInfo
        }
    };
});

exports.generateCustomToken = onCall({ cors: true }, async (request) => {
  const { sessionId } = request.data;
  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Session ID is required");
  }
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  try {
    const customToken = await admin.auth().createCustomToken(request.auth.uid);
    await db.collection("auth_sessions").doc(sessionId).set({
      token: customToken,
      uid: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Error generating custom token:", error);
    throw new HttpsError("internal", "Failed to generate custom token");
  }
});

/* =====================================================
   PROCESS SCHEDULED RIDES, REMINDERS, AUTO-DISPATCH & REASSIGNMENT (Every 1 Minute)
===================================================== */
exports.processScheduledRides = onSchedule("every 1 minutes", async (event) => {
    const now = Date.now();

    // Load dynamic admin config or fallback to approved business defaults
    let cfg = {
        maxAdvanceBookingDays: 7,
        autoDispatchLeadTimeMinutes: 30,
        passengerReminderLeadTimeMinutes: 60,
        driverReminderLeadTimeMinutes: 30,
        initialSearchRadiusKm: 5,
        maxSearchRadiusKm: 25,
        radiusExpansionStepKm: 5,
        maxDispatchDurationMinutes: 30,
        autoDispatchEnabled: true,
        driverReassignmentEnabled: true
    };
    try {
        const globalSnap = await db.collection("settings").doc("global").get();
        if (globalSnap.exists && globalSnap.data()?.scheduledRidesConfig) {
            cfg = { ...cfg, ...globalSnap.data().scheduledRidesConfig };
        }
    } catch (_) {}

    const passengerReminderLeadMs = (Number(cfg.passengerReminderLeadTimeMinutes) || 60) * 60 * 1000;
    const driverReminderLeadMs = (Number(cfg.driverReminderLeadTimeMinutes) || 30) * 60 * 1000;
    const autoDispatchLeadMs = (Number(cfg.autoDispatchLeadTimeMinutes) || 30) * 60 * 1000;
    const maxDispatchGraceMs = (Number(cfg.maxDispatchDurationMinutes) || 30) * 60 * 1000;

    // Query active scheduled rides
    const snapshot = await db.collection("rides")
        .where("isScheduled", "==", true)
        .get();

    if (snapshot.empty) return null;

    for (const docSnap of snapshot.docs) {
        const ride = { id: docSnap.id, ...docSnap.data() };
        if (
            ["COMPLETED", "CANCELLED", "EXPIRED"].includes(ride.status) ||
            ["COMPLETED", "CANCELLED", "NO_DRIVER_FOUND"].includes(ride.scheduleStatus)
        ) {
            continue;
        }

        const pickupAt = Number(ride.scheduledPickupAt || ride.scheduledTime || 0);
        if (!pickupAt) continue;

        const msUntilPickup = pickupAt - now;

        // 1. Check for NO_DRIVER_FOUND expiration after pickup + maxDispatchDurationMinutes
        if (!ride.driverId && now > pickupAt + maxDispatchGraceMs) {
            await docSnap.ref.update({
                status: "EXPIRED",
                scheduleStatus: "NO_DRIVER_FOUND",
                lastActiveAt: now
            });

            if (ride.pointsDeductedUpfront && !ride.pointsRefunded && Number(ride.pointsRedeemed) > 0) {
                await db.collection("users").doc(ride.passengerId).update({
                    rewardPoints: admin.firestore.FieldValue.increment(Number(ride.pointsRedeemed))
                }).catch(() => {});
                await docSnap.ref.update({ pointsRefunded: true }).catch(() => {});
            }

            if (ride.passengerId) {
                await db.collection("users").doc(ride.passengerId).collection("notifications").add({
                    type: "SCHEDULED_NO_DRIVER_FOUND",
                    rideId: ride.id,
                    title: "تعذر العثور على سائق لرحلتك المجدولة ⚠️",
                    message: "نعتذر، لم يتم العثور على سائق متاح لرحلتك المجدولة في الوقت المحدد.",
                    read: false,
                    timestamp: now,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            }
            continue;
        }

        // 2. Send 1-Hour Advance Passenger Reminder
        if (!ride.passengerReminderSentAt && msUntilPickup <= passengerReminderLeadMs && msUntilPickup > 0) {
            await docSnap.ref.update({ passengerReminderSentAt: now });
            if (ride.passengerId) {
                const title = "تذكير برحلتك المجدولة بعد ساعة ⏰";
                const body = ride.driverId
                    ? `رحلتك المجدولة مع الكابتن ${ride.driverName || ""} ستبدأ خلال ساعة.`
                    : `رحلتك المجدولة من ${ride.pickup?.address || ""} ستبدأ خلال ساعة.`;
                await db.collection("users").doc(ride.passengerId).collection("notifications").add({
                    type: "SCHEDULED_PASSENGER_REMINDER",
                    rideId: ride.id,
                    title,
                    message: body,
                    read: false,
                    timestamp: now,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});

                const uDoc = await db.collection("users").doc(ride.passengerId).get();
                const token = uDoc.data()?.fcmToken;
                if (token) {
                    await admin.messaging().send({
                        token,
                        notification: { title, body },
                        data: { type: "SCHEDULED_PASSENGER_REMINDER", rideId: String(ride.id) }
                    }).catch(() => {});
                }
            }
        }

        // 3. Driver Reminder & Availability Check (30 mins before pickup for Early-Accepted rides)
        if (ride.driverId && ride.scheduleStatus === "DRIVER_ASSIGNED" && !ride.driverReminderSentAt && msUntilPickup <= driverReminderLeadMs && msUntilPickup > -15 * 60 * 1000) {
            const drvDoc = await db.collection("users").doc(ride.driverId).get();
            const drv = drvDoc.exists ? drvDoc.data() : null;
            const isDriverInvalid = !drv || drv.isBanned || drv.isBlockedByFees || drv.status === "deactivated";

            if (isDriverInvalid && cfg.driverReassignmentEnabled) {
                const prevDrivers = Array.isArray(ride.previousDriverIds) ? [...ride.previousDriverIds, ride.driverId] : [ride.driverId];
                await docSnap.ref.update({
                    driverId: null,
                    driverName: null,
                    scheduleStatus: "SEARCHING_DRIVER",
                    status: "SEARCHING",
                    assignmentType: "AUTOMATIC_DISPATCH",
                    dispatchStartedAt: now,
                    lastReassignedAt: now,
                    reassignmentReason: "Driver unavailable prior to scheduled pickup",
                    previousDriverIds: prevDrivers,
                    timestamp: now
                });
                const newlyNotified = await notifyNearbyDrivers({ ...ride, searchRadiusKm: cfg.initialSearchRadiusKm });
                if (newlyNotified.length > 0) {
                    await docSnap.ref.update({
                        notifiedDriverIds: admin.firestore.FieldValue.arrayUnion(...newlyNotified)
                    });
                }
                continue;
            } else if (drv) {
                await docSnap.ref.update({ driverReminderSentAt: now });
                const title = "تذكير: حان موعد التحرك للرحلة المجدولة 🚖";
                const body = `يرجى التوجه إلى نقطة الانطلاق (${ride.pickup?.address || ""}) للراكب ${ride.passengerName || ""}.`;
                await db.collection("users").doc(ride.driverId).collection("notifications").add({
                    type: "SCHEDULED_DRIVER_REMINDER",
                    rideId: ride.id,
                    title,
                    message: body,
                    read: false,
                    timestamp: now,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});

                if (drv.fcmToken) {
                    await admin.messaging().send({
                        token: drv.fcmToken,
                        notification: { title, body },
                        data: { type: "SCHEDULED_DRIVER_REMINDER", rideId: String(ride.id) }
                    }).catch(() => {});
                }
            }
        }

        // 4. Stage B: Start Automatic Dispatch 30 minutes before pickup if no driver confirmed
        if (cfg.autoDispatchEnabled && !ride.driverId && ride.scheduleStatus === "SCHEDULED" && msUntilPickup <= autoDispatchLeadMs) {
            await docSnap.ref.update({
                status: "SEARCHING",
                scheduleStatus: "SEARCHING_DRIVER",
                assignmentType: "AUTOMATIC_DISPATCH",
                dispatchStartedAt: now,
                searchRadiusKm: cfg.initialSearchRadiusKm || 5,
                timestamp: now,
                lastActiveAt: now
            });

            const newlyNotified = await notifyNearbyDrivers({
                ...ride,
                searchRadiusKm: cfg.initialSearchRadiusKm || 5
            });
            if (newlyNotified.length > 0) {
                await docSnap.ref.update({
                    notifiedDriverIds: admin.firestore.FieldValue.arrayUnion(...newlyNotified)
                });
            }

            if (ride.passengerId) {
                const userDoc = await db.collection("users").doc(ride.passengerId).get();
                const token = userDoc.data()?.fcmToken;
                if (token) {
                    await admin.messaging().send({
                        token,
                        notification: {
                            title: "بدأ البحث التلقائي عن سائق 🔍",
                            body: "اقترب موعد رحلتك المجدولة! نبحث الآن عن أقرب سائق متاح."
                        },
                        android: { priority: "high", notification: { sound: "default", channelId: "ride_requests" } },
                        apns: { payload: { aps: { sound: "default" } } }
                    }).catch(() => {});
                }
            }
            continue;
        }

        // 5. Gradual Radius Expansion during Stage B Automatic Dispatch
        if (!ride.driverId && ride.scheduleStatus === "SEARCHING_DRIVER") {
            const currentRadius = Number(ride.searchRadiusKm || cfg.initialSearchRadiusKm || 5);
            const maxRadius = Number(cfg.maxSearchRadiusKm || 25);
            const stepKm = Number(cfg.radiusExpansionStepKm || 5);
            if (currentRadius < maxRadius) {
                const nextRadius = Math.min(maxRadius, currentRadius + stepKm);
                await docSnap.ref.update({
                    searchRadiusKm: nextRadius,
                    lastActiveAt: now
                });
                const newlyNotified = await notifyNearbyDrivers({ ...ride, searchRadiusKm: nextRadius });
                if (newlyNotified.length > 0) {
                    await docSnap.ref.update({
                        notifiedDriverIds: admin.firestore.FieldValue.arrayUnion(...newlyNotified)
                    });
                }
            }
        }
    }
    return null;
});

/* =====================================================
   ATOMIC SCHEDULED RIDE DRIVER ACCEPTANCE (CALLABLE)
===================================================== */
exports.acceptScheduledRideSecure = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const { rideId } = request.data || {};
    const driverId = request.auth.uid;
    if (!rideId) {
        throw new HttpsError("invalid-argument", "rideId is required.");
    }

    const driverSnap = await db.collection("users").doc(driverId).get();
    if (!driverSnap.exists) {
        throw new HttpsError("not-found", "Driver profile not found.");
    }
    const driver = driverSnap.data();
    if (driver.isBanned || driver.isBlockedByFees || driver.financialStatus === "blocked") {
        throw new HttpsError("permission-denied", "Driver account is restricted.");
    }
    const isApproved = driver.status === "approved" || driver.isApproved === true || driver.kycStatus === "APPROVED";
    if (!isApproved) {
        throw new HttpsError("permission-denied", "Driver must be approved to accept scheduled rides.");
    }

    // Check existing assigned scheduled rides for time conflicts
    const existingSnap = await db.collection("rides")
        .where("driverId", "==", driverId)
        .get();
    const existingRides = existingSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const rideRef = db.collection("rides").doc(rideId);
    const now = Date.now();

    await db.runTransaction(async (t) => {
        const rDoc = await t.get(rideRef);
        if (!rDoc.exists) {
            throw new HttpsError("not-found", "Scheduled ride not found.");
        }
        const ride = rDoc.data();
        if (ride.driverId && ride.driverId !== "" && ride.driverId !== driverId) {
            throw new HttpsError("already-exists", "Another driver has already accepted this scheduled ride.");
        }
        if (["CANCELLED", "COMPLETED", "EXPIRED"].includes(ride.status) || ["CANCELLED", "NO_DRIVER_FOUND"].includes(ride.scheduleStatus)) {
            throw new HttpsError("failed-precondition", "Scheduled ride is no longer available.");
        }

        const candStart = Number(ride.scheduledPickupAt || ride.scheduledTime || 0);
        const bufferMs = 30 * 60 * 1000;
        const candDurationMs = 25 * 60 * 1000;
        for (const ex of existingRides) {
            if (ex.id === rideId) continue;
            if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(ex.status)) continue;
            const exStart = Number(ex.scheduledPickupAt || ex.scheduledTime || 0);
            if (!exStart) continue;
            const exEnd = exStart + candDurationMs + bufferMs;
            if ((candStart - bufferMs) < exEnd && (exStart - bufferMs) < (candStart + candDurationMs + bufferMs)) {
                throw new HttpsError("failed-precondition", "Overlapping scheduled ride conflict detected.");
            }
        }

        const isAutoDispatch = ride.scheduleStatus === "SEARCHING_DRIVER";
        t.update(rideRef, {
            driverId,
            driverName: driver.name || "Captain",
            driverPhone: driver.phone || "",
            driverAvatar: driver.personalPhotoUrl || driver.avatar || "",
            driverRating: driver.rating || 5.0,
            driverVehicleModel: `${driver.vehicleBrand || ""} ${driver.vehicleModel || ""}`.trim(),
            driverVehiclePlate: driver.vehiclePlate || "",
            driverVehicleColor: driver.vehicleColor || "",
            scheduleStatus: "DRIVER_ASSIGNED",
            status: isAutoDispatch ? "ACCEPTED" : "SCHEDULED",
            driverAssignedAt: now,
            acceptedAt: now,
            assignmentType: isAutoDispatch ? "AUTOMATIC_DISPATCH" : "EARLY_ACCEPTANCE",
            fareLocked: true,
            lockedFare: ride.fare || 0,
            lastActiveAt: now
        });
    });

    return { success: true, rideId, driverId };
});

/* =====================================================
   ROLLING 7-DAY RECURRING RIDE INSTANCE GENERATOR (Every 1 Hour)
===================================================== */
function formatDatePartsInTimezone(utcMs, timezone) {
    const tz = timezone || "Africa/Cairo";
    const d = new Date(utcMs);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(d);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const dateStr = `${map.year}-${map.month}-${map.day}`;
    const wdShort = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
    const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dateStr, weekday: wdMap[wdShort] ?? d.getDay() };
}

function parseLocalDateTimeToUtcMs(dateStr, timeStr, timezone) {
    const tz = timezone || "Africa/Cairo";
    const [year, month, day] = String(dateStr || "").split("-").map(Number);
    const [hour, minute] = String(timeStr || "").split(":").map(Number);
    if (!year || !month || !day || isNaN(hour) || isNaN(minute)) return NaN;
    const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }).formatToParts(new Date(guessUtc));
        const map = {};
        for (const p of parts) {
            if (p.type !== "literal") map[p.type] = Number(p.value);
        }
        const tzHour = map.hour === 24 ? 0 : map.hour;
        const tzAsUtc = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second || 0, 0);
        return guessUtc - (tzAsUtc - guessUtc);
    } catch (_) {
        return guessUtc - 2 * 60 * 60 * 1000;
    }
}

exports.generateRecurringRideOccurrences = onSchedule("every 1 hours", async () => {
    const now = Date.now();
    let maxAdvanceBookingDays = 7;
    try {
        const globalSnap = await db.collection("settings").doc("global").get();
        if (globalSnap.exists && globalSnap.data()?.scheduledRidesConfig?.maxAdvanceBookingDays) {
            maxAdvanceBookingDays = Number(globalSnap.data().scheduledRidesConfig.maxAdvanceBookingDays) || 7;
        }
    } catch (_) {}

    const maxUtcMs = now + maxAdvanceBookingDays * 24 * 60 * 60 * 1000;
    const schedSnap = await db.collection("recurringSchedules").where("status", "==", "ACTIVE").get();
    if (schedSnap.empty) return null;

    let createdCount = 0;

    for (const schedDoc of schedSnap.docs) {
        const s = { id: schedDoc.id, ...schedDoc.data() };
        const tz = s.timezone || "Africa/Cairo";
        const startNoon = parseLocalDateTimeToUtcMs(s.startDate, "12:00", tz);
        const startWeekday = !isNaN(startNoon) ? formatDatePartsInTimezone(startNoon, tz).weekday : 0;

        // Fetch existing occurrences for this schedule to guarantee idempotency
        const existingSnap = await db.collection("rides")
            .where("recurringScheduleId", "==", s.id)
            .get();
        const existingKeys = new Set(existingSnap.docs.map(d => d.data().occurrenceKey).filter(Boolean));

        for (let offsetDays = 0; offsetDays <= maxAdvanceBookingDays + 1; offsetDays++) {
            const sampleMs = now + offsetDays * 24 * 60 * 60 * 1000;
            const { dateStr, weekday } = formatDatePartsInTimezone(sampleMs, tz);
            if (dateStr < s.startDate) continue;
            if (s.endDate && dateStr > s.endDate) continue;

            let matches = false;
            if (s.frequency === "ONE_TIME") matches = dateStr === s.startDate;
            else if (s.frequency === "DAILY") matches = true;
            else if (s.frequency === "SELECTED_WEEKDAYS") matches = Array.isArray(s.weekdays) && s.weekdays.includes(weekday);
            else if (s.frequency === "WEEKLY") {
                const targets = Array.isArray(s.weekdays) && s.weekdays.length > 0 ? s.weekdays : [startWeekday];
                matches = targets.includes(weekday);
            }
            if (!matches) continue;

            const scheduledPickupAt = parseLocalDateTimeToUtcMs(dateStr, s.pickupTime, tz);
            if (isNaN(scheduledPickupAt) || scheduledPickupAt <= now || scheduledPickupAt > maxUtcMs) continue;

            const occurrenceKey = `${s.id}_${dateStr}`;
            if (existingKeys.has(occurrenceKey)) continue;

            const deterministicRideId = `sched_${occurrenceKey}`;
            const rideRef = db.collection("rides").doc(deterministicRideId);
            await db.runTransaction(async (t) => {
                const cur = await t.get(rideRef);
                if (cur.exists) return;
                t.set(rideRef, {
                    id: deterministicRideId,
                    passengerId: s.passengerId,
                    passengerName: s.passengerName || "Passenger",
                    passengerPhone: s.passengerPhone || "",
                    pickup: s.pickup,
                    dropoff: s.dropoff,
                    category: s.category || "STANDARD",
                    fare: s.estimatedFare || 50,
                    estimatedFare: s.estimatedFare || 50,
                    paymentMethod: s.paymentMethod || "CASH",
                    status: "SCHEDULED",
                    isScheduled: true,
                    scheduledPickupAt,
                    scheduledTime: scheduledPickupAt,
                    scheduleStatus: "SCHEDULED",
                    recurringScheduleId: s.id,
                    occurrenceKey,
                    bookingTimezone: tz,
                    passengerCount: s.passengerCount || 1,
                    driverNote: s.driverNote || "",
                    bookingType: s.bookingType || "SELF",
                    actualPassenger: s.actualPassenger || null,
                    timestamp: now,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveAt: now,
                    notifiedDriverIds: [],
                    previousDriverIds: []
                });
            });
            existingKeys.add(occurrenceKey);
            createdCount++;
        }

        await schedDoc.ref.update({
            lastGeneratedWindowEnd: maxUtcMs,
            nextGenerationAt: now + 60 * 60 * 1000,
            updatedAt: now
        }).catch(() => {});
    }

    console.log(`[Recurring Generator] Created ${createdCount} rolling scheduled ride occurrences.`);
    return null;
});


/* =====================================================
   NOTIFY ADMIN ON NEW DRIVER KYC SUBMISSION
===================================================== */

let gmailEmail = process.env.GMAIL_EMAIL || "desp3030@gmail.com";
let gmailPassword = process.env.GMAIL_PASSWORD || "hocm cwud mdlz vvvk";

try {
  const fns = require("firebase-functions");
  if (fns.config().gmail) {
    gmailEmail = fns.config().gmail.email || gmailEmail;
    gmailPassword = fns.config().gmail.password || gmailPassword;
  }
} catch (e) {}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

exports.notifyAdminNewDriver = onDocumentUpdated("users/{userId}", async (event) => {
    try {
        const before = event.data.before.data();
        const after = event.data.after.data();

        // Prevent duplicate emails
        if (
            before.kycStatus !== "PENDING_REVIEW" &&
            after.kycStatus === "PENDING_REVIEW" &&
            !after.adminNotified
        ) {
            const driverName = after.name || "Unknown";
            const driverPhone = after.phone || "Unknown";
            const driverCity = after.city || "Unknown";
            const vehicleType = after.vehicleType || "Unknown";

            const mailOptions = {
                from: gmailEmail,
                to: "desp3030@gmail.com",
                subject: "🚖 New Driver Documents Submitted - Mowasla",
                html: `
                    <div style="font-family: Arial; padding:20px;">
                        <h2>🚖 New Driver Registration</h2>
                        <p>A driver has submitted documents for review.</p>
                        <hr />
                        <p><strong>Name:</strong> ${driverName}</p>
                        <p><strong>Phone:</strong> ${driverPhone}</p>
                        <p><strong>City:</strong> ${driverCity}</p>
                        <p><strong>Vehicle:</strong> ${vehicleType}</p>
                        <br />
                        <a href="https://waslny-7791e.web.app/admin"
                           style="
                             background:#ff9800;
                             color:white;
                             padding:12px 18px;
                             border-radius:8px;
                             text-decoration:none;
                           ">
                           Open Admin Dashboard
                        </a>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log("✅ Admin notification email sent.");

            // Create Realtime Admin Alert in 'notifications' collection
            await db.collection("notifications").add({
                type: "NEW_DRIVER_KYC",
                title: "New driver awaiting review",
                driverId: event.params.userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            // Prevent duplicate notifications
            await event.data.after.ref.update({
                adminNotified: true,
            });
        }
        return null;
    } catch (error) {
        console.error("❌ Email notification error:", error);
        return null;
    }
});

/* =====================================================
   DRIVER STATUS CHANGE PUSH NOTIFICATIONS
   Sends real-time FCM push notification and writes to user's
   notifications subcollection when Admin approves or rejects.
===================================================== */
exports.notifyDriverOnApprovalStatusChange = onDocumentUpdated("users/{userId}", async (event) => {
    try {
        const before = event.data.before ? event.data.before.data() : null;
        const after = event.data.after ? event.data.after.data() : null;
        const userId = event.params.userId;
        if (!before || !after) return null;

        const wasApproved = before.status === "approved" || before.kycStatus === "APPROVED" || before.isApproved === true || before.driverStatus === "approved";
        const isNowApproved = after.status === "approved" || after.kycStatus === "APPROVED" || after.isApproved === true || after.driverStatus === "approved";

        const wasRejected = before.status === "rejected" || before.kycStatus === "REJECTED" || before.driverStatus === "rejected";
        const isNowRejected = after.status === "rejected" || after.kycStatus === "REJECTED" || after.driverStatus === "rejected";

        const decisionTimestampChanged = Boolean(
            (after.driverApplicationStatusChangedAt && after.driverApplicationStatusChangedAt !== before.driverApplicationStatusChangedAt) ||
            (after.lastApprovalNotificationId && after.lastApprovalNotificationId !== before.lastApprovalNotificationId)
        );
        const approvedAtChanged = Boolean(after.approvedAt && after.approvedAt !== before.approvedAt);
        const rejectedAtChanged = Boolean(after.rejectedAt && after.rejectedAt !== before.rejectedAt);

        let notifType = null;
        let notifTitle = "";
        let notifBody = "";

        if (isNowApproved && (!wasApproved || decisionTimestampChanged || approvedAtChanged)) {
            notifType = "DRIVER_APPROVED";
            notifTitle = after.approvedNotice?.title || "تهانينا! تمت الموافقة على حسابك ككابتن 🎉";
            notifBody = after.approvedNotice?.body || "تمت الموافقة على مستنداتك وحسابك جاهز الآن لاستقبال المشاوير والعمل!";
        } else if (isNowRejected && (!wasRejected || decisionTimestampChanged || rejectedAtChanged)) {
            notifType = "DRIVER_REJECTED";
            notifTitle = after.rejectionNotice?.title || "تحديث بخصوص طلب انضمامك ككابتن ⚠️";
            const reason = after.rejectionReason;
            notifBody = after.rejectionNotice?.body || (reason 
                ? `نعتذر، لم يتم قبول طلبك للسبب التالي: ${reason}. يمكنك تعديل بياناتك وإعادة التقديم.`
                : "نعتذر، لم يتم قبول مستندات انضمامك ككابتن. يرجى مراجعة مستنداتك وإعادة التقديم.");
        }

        if (notifType) {
            const eventId = after.lastApprovalNotificationId || `${userId}_${notifType}_${after.driverApplicationStatusChangedAt || after.approvedAt || after.rejectedAt || event.id}`;
            console.log(`[Push Notification] Processing ${notifType} for driver ${userId} (eventId=${eventId})`);

            // Atomically claim dispatch so callable + trigger never duplicate FCM pushes or DB docs
            const claimed = await claimNotificationDispatch(userId, eventId, {
                type: notifType,
                title: notifTitle,
                body: notifBody,
                rejectionReason: after.rejectionReason || null,
                status: after.status || "",
                timestamp: Date.now(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            }).catch((e) => {
                console.warn("Failed to claim driver approval notification doc:", e.message);
                return true;
            });

            if (!claimed) {
                console.log(`[Push Notification] ${eventId} already dispatched; skipping duplicate trigger send.`);
                return null;
            }

            // Dispatch FCM push notification to the user's registered device token
            const token = isValidFcmToken(after.fcmToken) ? after.fcmToken : (isValidFcmToken(before.fcmToken) ? before.fcmToken : null);
            if (token) {
                try {
                    await admin.messaging().send({
                        token: token,
                        notification: {
                            title: notifTitle,
                            body: notifBody
                        },
                        data: {
                            type: notifType,
                            title: notifTitle,
                            body: notifBody,
                            status: String(after.status || ""),
                            kycStatus: String(after.kycStatus || ""),
                            rejectionReason: String(after.rejectionReason || ""),
                            eventId: String(eventId),
                            userId: String(userId),
                            timestamp: String(Date.now()),
                            click_action: "FLUTTER_NOTIFICATION_CLICK"
                        },
                        android: {
                            priority: "high",
                            notification: {
                                sound: "default",
                                channelId: "push_notifications_audio2",
                                priority: "high",
                                defaultVibrateTimings: true,
                                tag: notifType
                            }
                        },
                        apns: {
                            payload: {
                                aps: {
                                    sound: "default",
                                    badge: 1,
                                    contentAvailable: true
                                }
                            }
                        },
                        webpush: {
                            headers: {
                                Urgency: "high"
                            },
                            notification: {
                                title: notifTitle,
                                body: notifBody,
                                icon: "/favicon.ico",
                                badge: "/favicon.ico",
                                tag: `${notifType}_${userId}`,
                                renotify: true,
                                vibrate: [200, 100, 200]
                            },
                            fcmOptions: {
                                link: "/"
                            }
                        }
                    });
                    console.log(`[Push Notification] Dispatched ${notifType} FCM push to user ${userId}`);
                } catch (err) {
                    console.warn(`[Push Notification] FCM error for ${notifType} to user ${userId}:`, err.message);
                    await clearStaleFcmTokenIfUnchanged(userId, token, err);
                }
            } else {
                console.log(`[Push Notification] User ${userId} has no valid fcmToken registered yet.`);
            }
        }
        return null;
    } catch (err) {
        console.error("notifyDriverOnApprovalStatusChange error:", err);
        return null;
    }
});
