from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from tensorflow.keras.models import load_model
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load the pre-trained model with custom objects to handle 'mse'
try:
    model = load_model('air_quality_model.h5', custom_objects={'mse': tf.keras.losses.MeanSquaredError()})
    logger.info("Model loaded successfully.")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    raise

# Define the prediction endpoint
@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get the input data from the request
        data = request.get_json()
        if not data or not all(k in data for k in ['pm2_5', 'pm10', 'no2', 'o3', 'so2', 'co']):
            return jsonify({'error': 'Missing required parameters'}), 400

        # Extract and normalize the input data
        input_data = np.array([
            [data['pm2_5'], data['pm10'], data['no2'], data['o3'], data['so2'], data['co']]
        ])
        # Adjust normalization based on your training data
        min_values = np.array([0, 0, 0, 0, 0, 0])  # Replace with actual min values from training
        max_values = np.array([100, 100, 100, 200, 100, 500])  # Replace with actual max values from training
        normalized_input = (input_data - min_values) / (max_values - min_values)

        # Make prediction
        prediction = model.predict(normalized_input, verbose=0)
        predicted_aqi = float(prediction[0][0])  # Assuming single output for AQI (adjust index if needed)

        # Denormalize the prediction if the model was trained on normalized data
        aqi_min = 1
        aqi_max = 5
        predicted_aqi = aqi_min + (predicted_aqi * (aqi_max - aqi_min))

        logger.info(f"Predicted AQI: {predicted_aqi}")
        return jsonify({'predicted_aqi': round(predicted_aqi, 2)})
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

# Serve the HTML file with explicit UTF-8 encoding
@app.route('/')
def index():
    try:
        with open('index.html', 'r', encoding='utf-8') as file:
            return file.read()
    except UnicodeDecodeError as e:
        logger.error(f"Failed to decode index.html: {e}")
        return jsonify({'error': 'Failed to load HTML file due to encoding issues'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)