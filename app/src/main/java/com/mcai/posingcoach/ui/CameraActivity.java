package com.mcai.posingcoach.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import com.bumptech.glide.Glide;
import com.mcai.posingcoach.R;
import com.mcai.posingcoach.model.OfficialPose;

public class CameraActivity extends AppCompatActivity {

    private ImageView ivPoseGuide;
    private TextView tvGuideText;
    private ProgressBar loadingIndicator;
    private CardView pipContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_camera);

        // Bind Views
        ivPoseGuide = findViewById(R.id.iv_pose_guide);
        tvGuideText = findViewById(R.id.tv_guide_text);
        loadingIndicator = findViewById(R.id.loading_indicator);
        pipContainer = findViewById(R.id.pip_container);

        // Initial State
        pipContainer.setVisibility(View.GONE);

        // Handle Intent Data (Navigation from Library)
        if (getIntent() != null && getIntent().hasExtra("EXTRA_POSE_DATA")) {
            OfficialPose receivedPose = (OfficialPose) getIntent().getSerializableExtra("EXTRA_POSE_DATA");
            displayPoseGuide(receivedPose);
        } else {
            displayPoseGuide(null);
        }
    }

    /**
     * Updates the Floating PIP window with the provided Pose data.
     * Logic:
     * - If pose is OFFICIAL, load sketch_url.
     * - If pose is USER (custom), load source_url.
     * - Update guide text.
     */
    public void displayPoseGuide(OfficialPose pose) {
        if (pose == null) {
            pipContainer.setVisibility(View.GONE);
            tvGuideText.setText("");
            return;
        }

        pipContainer.setVisibility(View.VISIBLE);
        
        // Update Text
        tvGuideText.setText(pose.getGuideText());

        // Determine Image URL
        String imageUrl;
        if (pose.isOfficial()) {
            // Priority: Sketch URL > Source URL (fallback)
            if (pose.getSketchUrl() != null && !pose.getSketchUrl().isEmpty()) {
                imageUrl = pose.getSketchUrl();
            } else {
                imageUrl = pose.getSourceUrl();
            }
        } else {
            // User pose: always source
            imageUrl = pose.getSourceUrl();
        }

        // Load Image using Glide
        loadingIndicator.setVisibility(View.VISIBLE);
        
        if (imageUrl != null && !imageUrl.isEmpty()) {
            Glide.with(this)
                .load(imageUrl)
                .centerCrop()
                .placeholder(android.R.drawable.ic_menu_gallery) // Default placeholder
                .error(android.R.color.darker_gray) // Error placeholder
                .listener(new com.bumptech.glide.request.RequestListener<android.graphics.drawable.Drawable>() {
                    @Override
                    public boolean onLoadFailed(
                        com.bumptech.glide.load.engine.GlideException e,
                        Object model,
                        com.bumptech.glide.request.target.Target<android.graphics.drawable.Drawable> target,
                        boolean isFirstResource) {
                        loadingIndicator.setVisibility(View.GONE);
                        Toast.makeText(CameraActivity.this, "Failed to load guide image", Toast.LENGTH_SHORT).show();
                        return false; 
                    }

                    @Override
                    public boolean onResourceReady(
                        android.graphics.drawable.Drawable resource,
                        Object model,
                        com.bumptech.glide.request.target.Target<android.graphics.drawable.Drawable> target,
                        com.bumptech.glide.load.DataSource dataSource,
                        boolean isFirstResource) {
                        loadingIndicator.setVisibility(View.GONE);
                        return false;
                    }
                })
                .into(ivPoseGuide);
        } else {
            loadingIndicator.setVisibility(View.GONE);
            // Handle empty URL case
             ivPoseGuide.setImageResource(android.R.color.darker_gray);
        }
    }
}
