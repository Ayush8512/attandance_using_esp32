#include <Arduino.h>
#include "config.h"
#include "ble_scanner.h"
#include "wifi_client.h"

BLEScanner bleScanner;
WifiClientApp wifiApp;

QueueHandle_t deviceQueue;

void bleScanTask(void *pvParameters) {
    while (true) {
        bleScanner.scan();
        auto devices = bleScanner.getDetectedDevices();
        
        for (const auto& dev : devices) {
            if (xQueueSend(deviceQueue, &dev, pdMS_TO_TICKS(100)) != pdPASS) {
                Serial.println("Queue full, dropped device.");
            }
        }
        
        bleScanner.clearDetectedDevices();
        vTaskDelay(pdMS_TO_TICKS(BLE_SCAN_INTERVAL_MS));
    }
}

void reportTask(void *pvParameters) {
    wifiApp.init();
    
    while (true) {
        wifiApp.maintainConnection();
        
        // Update LED status based on WiFi connection
        if (wifiApp.isConnected()) {
            digitalWrite(LED_PIN, HIGH);
        } else {
            digitalWrite(LED_PIN, LOW);
        }

        ScannedDevice dev;
        if (xQueueReceive(deviceQueue, &dev, pdMS_TO_TICKS(1000)) == pdPASS) {
            wifiApp.reportDevice(dev);
        }
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    
    bleScanner.init();
    
    deviceQueue = xQueueCreate(DEVICE_QUEUE_SIZE, sizeof(ScannedDevice));
    if (deviceQueue == NULL) {
        Serial.println("Failed to create queue!");
        while (1);
    }
    
    xTaskCreatePinnedToCore(bleScanTask, "BLEScanTask", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(reportTask, "ReportTask", 8192, NULL, 1, NULL, 1);
}

void loop() {
    static unsigned long lastStatusPrint = 0;
    if (millis() - lastStatusPrint > 30000) {
        lastStatusPrint = millis();
        Serial.printf("--- STATUS ---\n");
        Serial.printf("WiFi Connected: %s\n", wifiApp.isConnected() ? "YES" : "NO");
        Serial.printf("Free Heap: %u bytes\n", ESP.getFreeHeap());
        Serial.printf("Items in Queue: %u\n", uxQueueMessagesWaiting(deviceQueue));
        Serial.printf("--------------\n");
    }
    delay(1000);
}
