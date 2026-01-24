package com.mcai.posingcoach.model;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

/**
 * Data model for Posing Coach structured data.
 * Supports both Official Poses (with sketches) and User Poses (raw images).
 */
public class OfficialPose implements Serializable {

    @SerializedName("id")
    private String id;

    @SerializedName("name")
    private String name;

    @SerializedName("category")
    private String category;

    @SerializedName("is_official")
    private boolean isOfficial;

    @SerializedName("source_url")
    private String sourceUrl;

    @SerializedName("sketch_url")
    private String sketchUrl;

    @SerializedName("guide_text")
    private String guideText;

    // No-args constructor for serialization
    public OfficialPose() {
    }

    public OfficialPose(String id, String name, String category, boolean isOfficial, String sourceUrl, String sketchUrl, String guideText) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.isOfficial = isOfficial;
        this.sourceUrl = sourceUrl;
        this.sketchUrl = sketchUrl;
        this.guideText = guideText;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public boolean isOfficial() {
        return isOfficial;
    }

    public void setOfficial(boolean official) {
        isOfficial = official;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getSketchUrl() {
        return sketchUrl;
    }

    public void setSketchUrl(String sketchUrl) {
        this.sketchUrl = sketchUrl;
    }

    /**
     * Returns the guide text or a default value if empty/null for robustness.
     */
    public String getGuideText() {
        if (guideText == null || guideText.trim().isEmpty()) {
            return "暂无引导";
        }
        return guideText;
    }

    public void setGuideText(String guideText) {
        this.guideText = guideText;
    }

    @Override
    public String toString() {
        return "OfficialPose{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", isOfficial=" + isOfficial +
                '}';
    }
}
