import hashlib
import hmac
import io
import os
import time
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_ID = "openai/clip-vit-base-patch32"
MODEL_PATH = os.getenv("MODEL_PATH", MODEL_ID)
JOB_ID = os.getenv("NOSANA_JOB_ID", "")
HOST_ID = os.getenv("NOSANA_HOST_ID", "")
INFERENCE_TOKEN = os.getenv("INFERENCE_TOKEN", "")
CATEGORIES = ["food", "menu", "exterior", "interior", "product", "before", "after", "atmosphere", "other"]
CATEGORY_PROMPTS = [
    "a clear photo of plated food or a restaurant dish",
    "a photo of a restaurant menu or menu board",
    "the outside facade or entrance of a store",
    "the interior seating and space of a restaurant",
    "a product package photographed for a review",
    "a before photo for a comparison review",
    "an after photo for a comparison review",
    "an atmospheric lifestyle photo showing the dining experience",
    "an unrelated or unclassifiable photo",
]
QUALITY_PROMPTS = [
    "a sharp, well lit, professionally composed photo",
    "a blurry, dark, overexposed, or poorly composed photo",
]

state = {"model": None, "processor": None, "error": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not torch.cuda.is_available():
        state["error"] = "CUDA is required; CPU fallback is deliberately disabled"
        yield
        return
    try:
        local_only = os.path.isdir(MODEL_PATH)
        state["processor"] = CLIPProcessor.from_pretrained(MODEL_PATH, local_files_only=local_only)
        state["model"] = CLIPModel.from_pretrained(MODEL_PATH, local_files_only=local_only).to("cuda").eval()
    except Exception as error:  # surfaced through /health rather than hidden
        state["error"] = str(error)
    yield


app = FastAPI(title="ReviewForge Nosana Media Intelligence", lifespan=lifespan)


@app.get("/health")
def health():
    ready = state["model"] is not None and torch.cuda.is_available()
    payload = {
        "status": "ok" if ready else "unavailable",
        "ready": ready,
        "modelLoaded": state["model"] is not None,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "gpuName": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "model": MODEL_ID,
        "jobId": JOB_ID,
        "hostId": HOST_ID,
        "error": state["error"],
    }
    if not ready:
        raise HTTPException(status_code=503, detail=payload)
    return payload


def probabilities(image: Image.Image, prompts: list[str]) -> list[float]:
    processor = state["processor"]
    model = state["model"]
    inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
    inputs = {key: value.to("cuda") for key, value in inputs.items()}
    with torch.inference_mode():
        output = model(**inputs)
        return output.logits_per_image.softmax(dim=1)[0].detach().cpu().tolist()


@app.post("/v1/classify")
async def classify(file: UploadFile = File(...), authorization: str | None = Header(default=None)):
    if INFERENCE_TOKEN:
        supplied = authorization.removeprefix("Bearer ") if authorization else ""
        if not hmac.compare_digest(supplied, INFERENCE_TOKEN):
            raise HTTPException(status_code=401, detail="Invalid inference token")
    if state["model"] is None or not torch.cuda.is_available():
        raise HTTPException(status_code=503, detail="CUDA model is not ready")
    started = time.perf_counter()
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 8 MB")
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Invalid image: {error}") from error

    category_scores = probabilities(image, CATEGORY_PROMPTS)
    quality_scores = probabilities(image, QUALITY_PROMPTS)
    index = max(range(len(category_scores)), key=category_scores.__getitem__)
    category = CATEGORIES[index]
    quality = quality_scores[0]
    hero_score = category_scores[0] * quality
    if category == "food" and hero_score >= 0.62:
        category = "hero"

    latency_ms = round((time.perf_counter() - started) * 1000)
    return {
        "fileName": file.filename,
        "inputSha256": hashlib.sha256(raw).hexdigest(),
        "category": category,
        "categoryConfidence": round(category_scores[index], 5),
        "qualityScore": round(quality, 5),
        "heroScore": round(hero_score, 5),
        "scores": {name: round(score, 5) for name, score in zip(CATEGORIES, category_scores)},
        "caption": f"CLIP classified this upload as {category}",
        "runtime": {
            "provider": "nosana",
            "device": "cuda",
            "gpuName": torch.cuda.get_device_name(0),
            "model": MODEL_ID,
            "jobId": JOB_ID,
            "hostId": HOST_ID,
            "latencyMs": latency_ms,
        },
        "proofUrl": f"https://explore.nosana.com/jobs/{JOB_ID}" if JOB_ID else None,
    }
