package com.mcai.posingcoach.ui;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.mcai.posingcoach.R;
import com.mcai.posingcoach.data.PoseRepository;
import com.mcai.posingcoach.model.OfficialPose;

import java.util.List;

public class PoseLibraryActivity extends AppCompatActivity {

    private RecyclerView rvPoseLibrary;
    private PoseLibraryAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pose_library);

        rvPoseLibrary = findViewById(R.id.rv_pose_library);

        // Data Setup
        List<OfficialPose> poseList = PoseRepository.getInstance().getOfficialPoses();

        // UI Setup
        adapter = new PoseLibraryAdapter(this, poseList);
        rvPoseLibrary.setLayoutManager(new LinearLayoutManager(this));
        rvPoseLibrary.setAdapter(adapter);
    }
}
