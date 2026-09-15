#pragma once

#include <Arduino.h>
#include <vector>
#include "config.h"

struct ScannedDevice {
    char uuid[UUID_MAX_LEN];
    int rssi;
    unsigned long timestamp;
};

class BLEScanner {
public:
    BLEScanner();
    void init();
    void scan();
    std::vector<ScannedDevice> getDetectedDevices();
    void clearDetectedDevices();

private:
    std::vector<ScannedDevice> detectedDevices;
    portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
    friend class MyAdvertisedDeviceCallbacks;
    void addDevice(const char* uuid, int rssi);
};
