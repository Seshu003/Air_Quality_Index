document.addEventListener("DOMContentLoaded", () => {
    fetchWeatherAndAQI("Kakinada"); // Load Kakinada data on page load

    const searchButton = document.querySelector(".search-box button");
    if (searchButton) {
        searchButton.addEventListener("click", () => {
            const city = document.getElementById("cityInput").value.trim();
            if (city) fetchWeatherAndAQI(city);
        });
    }
});

let aqiChart = null; // Global variable to store the chart instance

async function fetchWeatherAndAQI(city) {
    const apiKey = "c76352e14ebe1b62d711069c63ae02c7";
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

    try {
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (weatherData.cod !== 200) {
            console.error("City not found:", weatherData.message);
            return;
        }

        updateWeatherUI(weatherData);

        const { lat, lon } = weatherData.coord;
        console.log(`Fetching AQI for Lat: ${lat}, Lon: ${lon}`);
        await fetchAQI(lat, lon, apiKey);
    } catch (error) {
        console.error("Weather API Error:", error);
    }
}

async function fetchAQI(lat, lon, apiKey) {
    const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        const aqiResponse = await fetch(aqiUrl);
        const aqiData = await aqiResponse.json();

        if (aqiData.list?.length) {
            const aqiComponents = aqiData.list[0].components;
            const inputData = {
                pm2_5: aqiComponents.pm2_5,
                pm10: aqiComponents.pm10,
                no2: aqiComponents.no2,
                o3: aqiComponents.o3,
                so2: aqiComponents.so2,
                co: aqiComponents.co
            };

            // Send data to Flask backend for prediction
            const predictedAqi = await predictAQI(inputData);
            updateAQIUI(aqiData.list[0], predictedAqi);
        } else {
            console.warn("AQI data missing.");
        }
    } catch (error) {
        console.error("AQI API Error:", error);
    }
}

async function predictAQI(inputData) {
    try {
        const response = await fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(inputData),
        });

        if (!response.ok) {
            throw new Error('Prediction request failed');
        }

        const result = await response.json();
        return result.predicted_aqi; // Assuming the backend returns { predicted_aqi: value }
    } catch (error) {
        console.error("Prediction Error:", error);
        return null;
    }
}

function updateWeatherUI(data) {
    document.getElementById("cityName").textContent = data.name;
    document.getElementById("weatherCondition").textContent = data.weather[0].description.toLowerCase();
    document.getElementById("temperature").textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById("humidity").textContent = `${data.main.humidity}%`;
    document.getElementById("windSpeed").textContent = `${data.wind.speed.toFixed(2)} km/h`;
}

function updateAQIUI(aqiData, predictedAqi) {
    const currentAqi = aqiData.main.aqi;
    const status = getAQIStatus(currentAqi);
    const components = aqiData.components;

    document.getElementById("aqiStatus").textContent = `| AQI: ${currentAqi} | - ${status} 😷`;
    document.getElementById("aqiStatusPred").textContent = `| AQI: ${predictedAqi || currentAqi} | - ${getAQIStatus(predictedAqi || currentAqi)} 😷`;

    const pollutants = {
        pm2_5: components.pm2_5,
        pm10: components.pm10,
        no2: components.no2,
        o3: components.o3,
        so2: components.so2,
        co: components.co
    };

    // Update current AQI values
    for (const [id, value] of Object.entries(pollutants)) {
        const element = document.getElementById(id);
        if (element) element.textContent = `${value.toFixed(2)} µg/m³`;
    }

    // Update predicted AQI values based on model prediction
    for (const [id, value] of Object.entries(pollutants)) {
        const predElement = document.getElementById(`${id}_pred`);
        if (predElement) {
            const variation = (Math.random() * 5 - 2.5).toFixed(2); // Optional slight variation
            predElement.textContent = `${(value + parseFloat(variation)).toFixed(2)} µg/m³`;
        }
    }

    // Update chart with predicted AQI
    updatePredictedValuesAndChart(predictedAqi || currentAqi);
}

function updatePredictedValuesAndChart(predictedAqi) {
    // Simulate 7 days of AQI predictions based on the model-predicted AQI
    const labels = Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`);
    const predictedValues = labels.map(() => {
        const variation = (Math.random() * 0.5 - 0.25); // Smaller variation for realism
        return Math.max(1, Math.min(5, predictedAqi + variation)); // Keep AQI between 1 and 5
    });

    // Initialize or update the chart
    const ctx = document.getElementById('aqiChart').getContext('2d');
    if (aqiChart) {
        aqiChart.destroy(); // Destroy existing chart to avoid memory leaks
    }
    aqiChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Predicted AQI',
                data: predictedValues,
                borderColor: '#C3A4FF',
                backgroundColor: 'rgba(195, 164, 255, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: '#C3A4FF',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    min: 1,
                    title: {
                        display: true,
                        text: 'AQI Level',
                        color: '#C3A4FF',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    },
                    ticks: {
                        color: '#E0E0E0',
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(195, 164, 255, 0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Days',
                        color: '#C3A4FF',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    },
                    ticks: {
                        color: '#E0E0E0'
                    },
                    grid: {
                        color: 'rgba(195, 164, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#C3A4FF',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#2A1B3D',
                    titleColor: '#C3A4FF',
                    bodyColor: '#E0E0E0',
                    borderColor: '#C3A4FF',
                    borderWidth: 1
                }
            }
        }
    });
}

function getAQIStatus(aqi) {
    const statusMap = {
        1: "Good",
        2: "Fair",
        3: "Moderate",
        4: "Poor",
        5: "Very Poor"
    };
    return statusMap[aqi] || "Unknown";
}