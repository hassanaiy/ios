package com.ans.waslny;

import android.content.Context;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

public class AppSignatureHelper {

    private static final String TAG = "AppSignature";

    public static void printHash(Context context) {
        try {
            String packageName = context.getPackageName();
            android.content.pm.PackageManager pm = context.getPackageManager();

            android.content.pm.PackageInfo packageInfo;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                packageInfo = pm.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES);
                android.content.pm.Signature[] signatures = packageInfo.signingInfo.getApkContentsSigners();
                for (android.content.pm.Signature signature : signatures) {
                    processSignature(packageName, signature);
                }
            } else {
                packageInfo = pm.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNATURES);
                for (android.content.pm.Signature signature : packageInfo.signatures) {
                    processSignature(packageName, signature);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Error getting hash: " + e.getMessage());
        }
    }

    private static void processSignature(String packageName, android.content.pm.Signature signature) throws Exception {
        String appInfo = packageName + " " + signature.toCharsString();
        MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
        messageDigest.update(appInfo.getBytes(StandardCharsets.UTF_8));
        byte[] hashSignature = Arrays.copyOf(messageDigest.digest(), 9);

        String base64Hash = android.util.Base64.encodeToString(
                hashSignature,
                android.util.Base64.NO_PADDING | android.util.Base64.NO_WRAP);

        Log.d(TAG, "App Hash (for SMS Retriever): " + base64Hash.substring(0, 11));
    }
}
