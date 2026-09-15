#include "ble_scanner.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <map>

std::map<String, unsigned long> cooldownMap;

class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
    BLEScanner* scanner;
public:
    MyAdvertisedDeviceCallbacks(BLEScanner* s) : scanner(s) {}

    void onResult(BLEAdvertisedDevice advertisedDevice) {
        if (advertisedDevice.haveServiceUUID()) {
            BLEUUID targetUUID(TARGET_SERVICE_UUID);
            if (advertisedDevice.isAdvertisingService(targetUUID)) {
                int rssi = advertisedDevice.getRSSI();
                if (rssi >= RSSI_THRESHOLD) {
                    String devMac = advertisedDevice.getAddress().toString().c_str();
                    unsigned long now = millis();

                    if (cooldownMap.find(devMac) == cooldownMap.end() || 
                        (now - cooldownMap[devMac]) > DEVICE_COOLDOWN_MS) {
                        
                        cooldownMap[devMac] = now;
                        scanner->addDevice(TARGET_SERVICE_UUID, rssi);
                        Serial.printf("Detected target device. RSSI: %d\n", rssi);
                    }
                }
            }
        }
    }
};

BLEScanner::BLEScanner() {
}

void BLEScanner::init() {
    BLEDevice::init("");
    BLEScan* pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks(this));
    pBLEScan->setActiveScan(true);
    pBLEScan->setInterval(100);
    pBLEScan->setWindow(99);
}

void BLEScanner::scan() {
    Serial.println("Starting BLE scan...");
    BLEScan* pBLEScan = BLEDevice::getScan();
    pBLEScan->clearResults();
    pBLEScan->start(BLE_SCAN_DURATION_SEC, false);
    Serial.println("BLE scan finished.");
}

void BLEScanner::addDevice(const char* uuid, int rssi) {
    ScannedDevice dev;
    strncpy(dev.uuid, uuid, UUID_MAX_LEN - 1);
    dev.uuid[UUID_MAX_LEN - 1] = '\0';
    dev.rssi = rssi;
    dev.timestamp = millis();

    portENTER_CRITICAL(&mux);
    detectedDevices.push_back(dev);
    portEXIT_CRITICAL(&mux);
}

std::vector<ScannedDevice> BLEScanner::getDetectedDevices() {
    std::vector<ScannedDevice> copy;
    portENTER_CRITICAL(&mux);
    copy = detectedDevices;
    portEXIT_CRITICAL(&mux);
    return copy;
}

void BLEScanner::clearDetectedDevices() {
    portENTER_CRITICAL(&mux);
    detectedDevices.clear();
    portEXIT_CRITICAL(&mux);
}
