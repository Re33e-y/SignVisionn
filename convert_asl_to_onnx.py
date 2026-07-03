"""
ASL Model Converter: .keras -> .onnx
-------------------------------------
Run this on a machine with Python 3.10 or 3.11.
"""
 
import os
import sys
import tensorflow as tf
import tf2onnx
import onnx
 
MODEL_IN  = "asl_model.keras"   
MODEL_OUT = "public/models/asl_model.onnx"
 
os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
 
try:
    # Use tf.keras which handles .keras (Keras 3) files
    model = tf.keras.models.load_model(MODEL_IN)
    print(f"✓ Model loaded  — input: {model.input_shape}  output: {model.output_shape}")
except Exception as e:
    print(f"✗ Load failed: {e}")
    sys.exit(1)
 
print("Converting to ONNX...")
 
input_signature = [
    tf.TensorSpec(
        shape=(None, 224, 224, 3),
        dtype=tf.float32,
        name="input"
    )
]
 
onnx_model, _ = tf2onnx.convert.from_keras(
    model,
    input_signature=input_signature,
    opset=17,           
    output_path=MODEL_OUT,
)
 
print(f"✓ Saved to {MODEL_OUT}")
