from google import genai
from google.genai import types
import os
import json
import time
import uuid
import logging
import base64
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("factory.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# Load environment variables
env_path = Path('.env.local')
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)

# Configuration with fallback manual parsing
API_KEY = os.getenv("VITE_GEMINI_API_KEY")
if not API_KEY and env_path.exists():
    try:
        content = env_path.read_text(encoding='utf-8')
        for line in content.splitlines():
            if line.strip().startswith('VITE_GEMINI_API_KEY='):
                API_KEY = line.split('=', 1)[1].strip().strip('"\'')
                break
    except:
        pass
if not API_KEY:
    logging.error("CRITICAL: VITE_GEMINI_API_KEY not found.")
    exit(1)

logging.info(f"API_KEY loaded: {API_KEY[:4]}...{API_KEY[-4:] if len(API_KEY)>8 else ''}")
client = genai.Client(api_key=API_KEY)

# Constants
INPUT_DIR = Path("input_photos")
OUTPUT_DIR = Path("output_assets")
INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# New Prompt for Rough Pencil Sketch Style
PENCIL_SKETCH_PROMPT = (
    "A dynamic pencil sketch drawing of the pose shown in the reference image. "
    "The style uses deliberately rough, casual, and spontaneous pencil lines to capture movement and vitality. "
    "It is a relaxed, gestural drawing focusing on the essence of the action. "
    "The figure is faceless but with clear anatomical proportions and structure. "
    "The background is pure, plain white paper, providing a clean canvas that makes the textured pencil lines stand out sharply. "
    "No photorealism, just expressive rough sketch art."
)

def analyze_pose_and_get_guide(image_path: Path):
    """
    Step 1: Get the 'vibe' and guide text from the image using Vision model.
    """
    try:
        logging.info(f"Analyzing {image_path.name}...")
        img = Image.open(image_path)
        
        prompt_text = """
        Analyze this full-body model photo. Return a valid JSON object with one key:
        1. "guide_text": A single, short, encouraging, professional instruction for a model to recreate this pose. Max 15 words. Simplified Chinese.
        
        Output JSON only. Do not use markdown blocks.
        """
        
        # Try list of vision models for analysis
        vision_models = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-pro", "gemini-2.0-flash-exp"]
        response = None
        
        for model_id in vision_models:
            try:
                logging.info(f"Analyzing with {model_id}...")
                response = client.models.generate_content(
                    model=model_id,
                    contents=[prompt_text, img]
                )
                break
            except Exception as e:
                 logging.warning(f"Vision model {model_id} failed: {e}")
        
        if not response or not response.text:
             raise ValueError("All vision models failed or empty response")

        text = response.text.replace("```json", "").replace("```", "").strip()
        try:
             data = json.loads(text)
        except json.JSONDecodeError:
             logging.warning(f"JSON Parse Error. Raw text: {text}")
             return "请参考图片姿势"
             
        return data.get("guide_text", "保持自信，看向镜头")
        
    except Exception as e:
        logging.error(f"Vision analysis failed for {image_path.name}: {e}")
        return "请参考图片姿势"


def generate_sketch_ai(image_path: Path, output_path: Path):
    """
    Step 2: Generate the sketch using Gemini/Imagen with the new prompt and configuration.
    """
    # List of models to try in order of preference
    models_to_try = [
        "gemini-2.0-flash-exp",
        "imagen-3.0-generate-002",
        "gemini-3-pro-image-preview",
        # Adding explicit Nano Banana if needed, but going with user's priority
    ]
    
    img = Image.open(image_path)

    logging.info(f"Attempting AI Sketch Generation for {output_path.name}...")

    for model_id in models_to_try:
        try:
            logging.info(f"Trying model: {model_id}...")
            
            # Using generate_content with response_modalities=['IMAGE']
            # We pass the Input Image + Prompt for multimodal generation
            response = client.models.generate_content(
                model=model_id,
                contents=[PENCIL_SKETCH_PROMPT, img],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(
                        aspect_ratio="3:4" # Using 3:4 for portrait poses
                    )
                )
            )
            
            # Parse response
            if response.candidates:
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            image_data = None
                            
                            # Check for inline_data (base64)
                            if part.inline_data:
                                image_data = part.inline_data.data
                            # Check for other ways SDK might return image bits (e.g. if it returns a specific Image object structure, but inline_data is standard for generate_content image output in this SDK)
                            
                            if image_data:
                                if isinstance(image_data, str):
                                    image_data = base64.b64decode(image_data)
                                
                                with open(output_path, "wb") as f:
                                    f.write(image_data)
                                logging.info(f"SUCCESS: Sketch saved to {output_path} using {model_id}")
                                return True
            
            logging.warning(f"Model {model_id} returned no image candidates.")

        except Exception as e:
            logging.warning(f"Model {model_id} failed: {e}")
            continue
            
    logging.error("All AI models failed to generate the sketch.")
    return False


def generate_pose_id(filename: str) -> str:
    return f"pose_{Path(filename).stem}_{str(uuid.uuid4())[:8]}"

def load_existing_manifest(path: Path):
    if path.exists():
        try:
            with open(path, "r", encoding='utf-8') as f:
                return {item['id']: item for item in json.load(f)}
        except:
            return {}
    return {}

def main():
    poses = []
    existing_data = load_existing_manifest(OUTPUT_DIR / "official_poses.json")
    
    # Find inputs
    input_files = []
    for ext in ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG"]:
        input_files.extend(list(INPUT_DIR.glob(f"*.{ext}")))
    input_files = list(set(input_files))

    if not input_files:
        logging.warning(f"No images found in {INPUT_DIR}. Please add photos.")
        return

    logging.info(f"Found {len(input_files)} inputs. Processing...")

    for img_file in input_files:
        logging.info(f"Processing {img_file.name}...")
        sketch_filename = f"{img_file.stem}_sketch.png"
        sketch_path = OUTPUT_DIR / sketch_filename
        
        # 1. Analysis (Guide Text - Preserve or Refresh)
        current_guide_text = None
        for ex_k, ex_v in existing_data.items():
            if ex_v.get('sketch_url', '').endswith(sketch_filename):
                current_guide_text = ex_v.get('guide_text')
                break
        
        guide_text = "保持自信，看向镜头"
        
        if current_guide_text and "请参考图片" not in current_guide_text and "暂无引导" not in current_guide_text:
             logging.info(f"Preserving existing guide: {current_guide_text}")
             guide_text = current_guide_text
        else:
             guide_text = analyze_pose_and_get_guide(img_file)
        
        # 2. Sketch Generation
        success = generate_sketch_ai(img_file, sketch_path)
            
        if success:
            pose_id = generate_pose_id(img_file.name)
            # Preserve ID
            for ex_k, ex_v in existing_data.items():
                if ex_v.get('sketch_url', '').endswith(sketch_filename):
                    pose_id = ex_v.get('id', pose_id)
                    break
            
            pose_entry = {
                "id": pose_id,
                "name": img_file.stem.replace("_", " ").title(),
                "category": "Smart Guide", 
                "is_official": True,   
                "source_url": "",      
                "sketch_url": f"file:///android_asset/sketches/{sketch_filename}",
                "guide_text": guide_text 
            }
            poses.append(pose_entry)
            time.sleep(1)
        else:
            logging.error(f"Failed to generate output for {img_file.name}")

    # Write Manifest
    json_path = OUTPUT_DIR / "official_poses.json"
    with open(json_path, "w", encoding='utf-8') as f:
        json.dump(poses, f, indent=4, ensure_ascii=False)
    
    logging.info(f"Done. Manifest: {json_path}")
    logging.info(f"Total Assets: {len(poses)}")

if __name__ == "__main__":
    main()

