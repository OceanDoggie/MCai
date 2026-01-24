package com.mcai.posingcoach.data;

import com.mcai.posingcoach.model.OfficialPose;

import java.util.ArrayList;
import java.util.List;

/**
 * Singleton repository for accessing Pose data.
 * Currently provides mock data for "Official Poses".
 */
public class PoseRepository {

    private static PoseRepository instance;
    private List<OfficialPose> officialPoses;

    private PoseRepository() {
        officialPoses = new ArrayList<>();
        initializeMockData();
    }

    public static synchronized PoseRepository getInstance() {
        if (instance == null) {
            instance = new PoseRepository();
        }
        return instance;
    }

    public List<OfficialPose> getOfficialPoses() {
        return officialPoses;
    }

    private void initializeMockData() {
        // Mock Data: 5 Official Poses
        // Using placehold.co for visible images
        
        officialPoses.add(new OfficialPose(
                "official_001",
                "The Lean",
                "Portrait",
                true,
                "https://placehold.co/400x600/png?text=Source+The+Lean",
                "https://placehold.co/400x600/png?text=Sketch+The+Lean",
                "Lean slightly against a wall, crossing your arms loosely."
        ));

        officialPoses.add(new OfficialPose(
                "official_002",
                "Hair Tuck",
                "Portrait",
                true,
                "https://placehold.co/400x600/png?text=Source+Hair+Tuck",
                "https://placehold.co/400x600/png?text=Sketch+Hair+Tuck",
                "Gently tuck your hair behind one ear while looking at the camera."
        ));

        officialPoses.add(new OfficialPose(
                "official_003",
                "Walking Away",
                "Street",
                true,
                "https://placehold.co/400x600/png?text=Source+Walking",
                "https://placehold.co/400x600/png?text=Sketch+Walking",
                "Walk slowly away from the camera, turning your head back slightly."
        ));

        officialPoses.add(new OfficialPose(
                "official_004",
                "Coffee Date",
                "Lifestyle",
                true,
                "https://placehold.co/400x600/png?text=Source+Coffee",
                "https://placehold.co/400x600/png?text=Sketch+Coffee",
                "Hold your cup with both hands, elbows on the table, looking down."
        ));

        officialPoses.add(new OfficialPose(
                "official_005",
                "Close-up Smile",
                "Close-up",
                true,
                "https://placehold.co/400x600/png?text=Source+Smile",
                "https://placehold.co/400x600/png?text=Sketch+Smile",
                "A tight headshot. Smile naturally with your eyes."
        ));
    }
}
