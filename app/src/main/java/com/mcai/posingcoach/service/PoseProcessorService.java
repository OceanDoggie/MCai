package com.mcai.posingcoach.service;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Service class responsible for interacting with the AI Pose Generation API.
 * Converts a source image into a sketch guide and guide text.
 */
public class PoseProcessorService {

    private static final String TAG = "PoseProcessorService";

    // TODO: Replace with real API endpoint and Key
    private static final String API_BASE_URL = "https://api.example.com/v1/pose/sketch";
    private static final String API_KEY = "YOUR_API_KEY_HERE";

    private final OkHttpClient client;
    private final Handler mainHandler; // To post callbacks to the UI thread

    public PoseProcessorService() {
        this.client = new OkHttpClient();
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    /**
     * Asynchronously processes the source image to generate a sketch and guide
     * text.
     *
     * @param sourceImageUrl The URL of the source image to process.
     * @param callback       The callback to receive the result or error.
     */
    public void processSourceImage(String sourceImageUrl, final PoseCallback callback) {
        if (sourceImageUrl == null || sourceImageUrl.isEmpty()) {
            postError(callback, "Invalid source image URL.");
            return;
        }

        // Construct JSON body
        JSONObject jsonBody = new JSONObject();
        try {
            jsonBody.put("image_url", sourceImageUrl);
            // Add other parameters if needed, e.g., model version, prompt, etc.
        } catch (JSONException e) {
            postError(callback, "Failed to create request body: " + e.getMessage());
            return;
        }

        MediaType JSON = MediaType.get("application/json; charset=utf-8");
        RequestBody body = RequestBody.create(jsonBody.toString(), JSON);

        Request request = new Request.Builder()
                .url(API_BASE_URL)
                .addHeader("Authorization", "Bearer " + API_KEY)
                .post(body)
                .build();

        // Async execution
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Network request failed", e);
                postError(callback, "Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    Log.e(TAG, "API returned error code: " + response.code());
                    postError(callback, "AI processing failed. Code: " + response.code());
                    return;
                }

                String responseData = response.body().string();
                if (responseData == null || responseData.isEmpty()) {
                    postError(callback, "Empty response from server.");
                    return;
                }

                try {
                    JSONObject jsonResponse = new JSONObject(responseData);

                    // Robust parsing: check for result fields
                    // API Contract assumed: { "result_sketch_url": "...", "pose_description": "..."
                    // }

                    String sketchUrl = jsonResponse.optString("result_sketch_url", "");
                    String guideText = jsonResponse.optString("pose_description", "暂无引导");

                    if (sketchUrl.isEmpty()) {
                        // Check for specific error message in JSON if API returns 200 OK but with
                        // logical error
                        // e.g. { "status": "error", "message": "...." }
                        String potentialError = jsonResponse.optString("message", "Unknown error in response data.");
                        postError(callback, "No sketch URL found: " + potentialError);
                        return;
                    }

                    postSuccess(callback, sketchUrl, guideText);

                } catch (JSONException e) {
                    Log.e(TAG, "JSON parsing error", e);
                    postError(callback, "Failed to parse server response.");
                }
            }
        });
    }

    private void postSuccess(final PoseCallback callback, final String sketchUrl, final String guideText) {
        if (callback != null) {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    callback.onSuccess(sketchUrl, guideText);
                }
            });
        }
    }

    private void postError(final PoseCallback callback, final String errorMessage) {
        if (callback != null) {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    callback.onError(errorMessage);
                }
            });
        }
    }
}
