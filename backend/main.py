from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import joblib
import numpy as np
import os
import torch
from transformers import AutoTokenizer, AutoModel

# Load the local BERT model once during startup
print("Loading local BERT model...")
tokenizer = AutoTokenizer.from_pretrained('bert-base-multilingual-cased')
bert_model = AutoModel.from_pretrained('bert-base-multilingual-cased')
print("BERT loaded successfully.")

app = FastAPI(title="Clinical Voice AI API")

# Allow all origins for local development (mobile app needs to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')

# Global cache for loaded models
loaded_models = {}

class PredictionRequest(BaseModel):
    embeddings: List[float]
    requiredModels: List[str]

class TextPredictionRequest(BaseModel):
    text: str
    requiredModels: List[str]

@app.post("/predict")
async def predict(request: PredictionRequest):
    if len(request.embeddings) != 768:
        raise HTTPException(status_code=400, detail="Embeddings must be exactly 768-dimensional")
    
    # Reshape the 1D list into a 2D array of shape (1, 768) as scikit-learn expects
    X = np.array(request.embeddings).reshape(1, -1)
    
    results = []
    
    for model_name in request.requiredModels:
        # Load model from disk or cache
        if model_name not in loaded_models:
            model_path = os.path.join(MODELS_DIR, model_name)
            if not os.path.exists(model_path):
                print(f"Warning: Model {model_name} not found at {model_path}")
                continue
            
            try:
                loaded_models[model_name] = joblib.load(model_path)
            except Exception as e:
                print(f"Error loading {model_name}: {str(e)}")
                continue
        
        model = loaded_models[model_name]
        
        try:
            # Get probability if supported
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X)[0]
                
                # If binary classification (2 classes)
                if len(probs) == 2:
                    confidence = float(probs[1] * 100)
                else:
                    # For multi-class (like severity: 0, 1, 2)
                    # Let's map it so the frontend can interpret it:
                    # If it predicts 2 (Severe) with high probability, confidence approaches 100
                    # If it predicts 1 (Moderate), confidence is around 50
                    # If 0 (Normal), confidence is around 0
                    predicted_class = np.argmax(probs)
                    if predicted_class == 2:
                        confidence = float(70 + (probs[2] * 30)) # 70-100%
                    elif predicted_class == 1:
                        confidence = float(40 + (probs[1] * 29)) # 40-69%
                    else:
                        confidence = float(probs[0] * 39) # 0-39%
            else:
                pred = model.predict(X)
                if model_name == 'severity_expert.joblib':
                    if pred[0] == 2: confidence = 100.0
                    elif pred[0] == 1: confidence = 50.0
                    else: confidence = 0.0
                else:
                    confidence = 100.0 if pred[0] == 1 else 0.0
                
            results.append({
                "model": model_name,
                "confidence": round(confidence, 1)
            })
        except Exception as e:
            print(f"Error predicting with {model_name}: {str(e)}")
            
    return {"results": results}

@app.post("/predict-text")
async def predict_text(request: TextPredictionRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
        
    # Extract embeddings using local BERT model
    inputs = tokenizer(request.text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = bert_model(**inputs)
        # Take the CLS token embedding (first token of the last hidden state)
        embeddings = outputs.last_hidden_state[0][0].numpy().tolist()
        
    # Now run the embeddings through the requested joblib models
    X = np.array(embeddings).reshape(1, -1)
    
    results = []
    
    for model_name in request.requiredModels:
        # Load model from disk or cache
        if model_name not in loaded_models:
            model_path = os.path.join(MODELS_DIR, model_name)
            if not os.path.exists(model_path):
                continue
            try:
                loaded_models[model_name] = joblib.load(model_path)
            except:
                continue
        
        model = loaded_models[model_name]
        try:
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X)[0]
                if len(probs) == 2:
                    confidence = float(probs[1] * 100)
                else:
                    predicted_class = np.argmax(probs)
                    if predicted_class == 2: confidence = float(70 + (probs[2] * 30))
                    elif predicted_class == 1: confidence = float(40 + (probs[1] * 29))
                    else: confidence = float(probs[0] * 39)
            else:
                pred = model.predict(X)
                if model_name == 'severity_expert.joblib':
                    if pred[0] == 2: confidence = 100.0
                    elif pred[0] == 1: confidence = 50.0
                    else: confidence = 0.0
                else:
                    confidence = 100.0 if pred[0] == 1 else 0.0
                    
            results.append({"model": model_name, "confidence": round(confidence, 1)})
        except:
            pass
            
    return {"results": results, "embeddings": embeddings}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
