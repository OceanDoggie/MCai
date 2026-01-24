package com.mcai.posingcoach.ui;

import android.content.Context;
import android.content.Intent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.mcai.posingcoach.R;
import com.mcai.posingcoach.model.OfficialPose;

import java.util.List;

public class PoseLibraryAdapter extends RecyclerView.Adapter<PoseLibraryAdapter.ViewHolder> {

    private List<OfficialPose> poseList;
    private Context context;

    public PoseLibraryAdapter(Context context, List<OfficialPose> poseList) {
        this.context = context;
        this.poseList = poseList;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_pose, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        OfficialPose pose = poseList.get(position);
        holder.tvName.setText(pose.getName());
        holder.tvCategory.setText(pose.getCategory());

        // Click Listener: Navigate to Camera
        holder.itemView.setOnClickListener(v -> {
            Intent intent = new Intent(context, CameraActivity.class);
            intent.putExtra("EXTRA_POSE_DATA", pose);
            context.startActivity(intent);
        });
    }

    @Override
    public int getItemCount() {
        return poseList != null ? poseList.size() : 0;
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvName;
        TextView tvCategory;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tv_pose_name);
            tvCategory = itemView.findViewById(R.id.tv_pose_category);
        }
    }
}
