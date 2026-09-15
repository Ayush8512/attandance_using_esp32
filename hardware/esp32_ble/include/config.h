#pragma once

// ===== WiFi Configuration =====
#define WIFI_SSID           "YOUR_WIFI_SSID"
#define WIFI_PASSWORD       "YOUR_WIFI_PASSWORD"
#define WIFI_CONNECT_TIMEOUT_MS  15000   // 15 second timeout

// ===== Backend API =====
#define API_BASE_URL        "http://192.168.1.100:8000"
#define API_VERIFY_LOCATION API_BASE_URL "/api/verify-location"
#define CLASSROOM_ID        "ROOM_101"

// ===== BLE Scanner =====
#define BLE_SCAN_DURATION_SEC   5        // How long each scan runs
#define BLE_SCAN_INTERVAL_MS    10000    // Pause between scans
#define RSSI_THRESHOLD          -75      // dBm, only report stronger signals
#define TARGET_SERVICE_UUID     "12345678-1234-1234-1234-123456789abc"

// ===== Anti-duplicate =====
#define DEVICE_COOLDOWN_MS      60000    // Don't re-report same device within 60s

// ===== Status LED =====
#define LED_PIN                 2        // Built-in LED on most ESP32 boards

// ===== Queue =====
#define DEVICE_QUEUE_SIZE       20
#define UUID_MAX_LEN            40
