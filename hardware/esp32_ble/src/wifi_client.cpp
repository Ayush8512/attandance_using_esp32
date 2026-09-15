#include "wifi_client.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

void WifiClientApp::init() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    Serial.print("Connecting to WiFi");
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
        delay(500);
        Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected.");
    } else {
        Serial.println("\nWiFi connection timeout.");
    }
}

void WifiClientApp::maintainConnection() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Reconnecting to WiFi...");
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        // Non-blocking reconnect, we just let it try in background
    }
}

bool WifiClientApp::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void WifiClientApp::reportDevice(const ScannedDevice& dev) {
    if (!isConnected()) {
        Serial.println("Cannot report, WiFi disconnected.");
        return;
    }

    HTTPClient http;
    http.begin(API_VERIFY_LOCATION);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["ble_uuid"] = dev.uuid;
    doc["classroom_id"] = CLASSROOM_ID;
    doc["rssi"] = dev.rssi;
    
    String jsonStr;
    serializeJson(doc, jsonStr);
    
    int httpResponseCode = http.POST(jsonStr);
    
    if (httpResponseCode > 0) {
        Serial.printf("POST success. Response code: %d\n", httpResponseCode);
        // LED Blink for success
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
    } else {
        Serial.printf("Error on POST. HTTP response code: %d\n", httpResponseCode);
    }
    http.end();
}
