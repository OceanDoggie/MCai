# 📸 MCai (Model Coach AI)

> **Your Real-Time AI Photography Coach, powered by Google Gemini 3.**

[![Gemini 3 Hackathon](https://img.shields.io/badge/Submission-Gemini%203%20Hackathon-4285F4?style=for-the-badge&logo=google)](https://devpost.com/software/mcai)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Status](https://img.shields.io/badge/Status-Prototype-orange?style=flat)

**MCai** transforms the solitary act of taking a photo into an interactive, guided session. By leveraging the multimodal capabilities of **Gemini 3**, MCai understands 3D space, body geometry, and photographic composition in real-time, offering voice and visual guidance just like a professional human photographer.

---

## 🎥 Demo

[Insert link to your YouTube/Vimeo Demo Video Here]

---

## 🚀 Key Features

### 1.  Multimodal Planning (Smart Booklets)
Upload *any* reference photo (from Pinterest, Instagram, etc.). MCai uses **Gemini 3 Vision** to deconstruct the image, analyzing the lighting, camera angle, and pose to create a structured "shooting plan" for you.

### 2.  Real-Time AI Coaching (The Core)
Start the camera, and the **Live Session** begins.
* **Spatial Awareness:** MCai calculates your distance (e.g., "1.8m"), camera height ("Chest Level"), and tilt angle ("Inward 15°").
* **Skeletal Tracking:** Uses computer vision to track key body landmarks.
* **Instant Feedback Loop:** If your pose is off, Gemini generates specific, natural language instructions (e.g., *"Point your toe toward the camera"* or *"Chin up slightly"*).

### 3.  AI Session Scoring
After the shoot, receive a comprehensive **AI Score** based on composition accuracy, pose stability, and angle matching. Keep track of your progress in the Gallery.

---

##  How it Works (Architecture)

MCai is a hybrid application combining high-frequency local computer vision with the semantic reasoning of Gemini 3.

```mermaid
graph TD
    A[User Camera] -->|Video Stream| B(Frontend Client / Next.js)
    B -->|Skeletal Landmarks| C{Heuristic Layer}
    C -->|Vector Data + Frame| D[Backend / Python]
    D -->|Multimodal Prompt| E[Google Gemini 3 API]
    E -->|JSON Instruction| D
    D -->|WebSocket| B
    B -->|UI Overlay/Toast| A
