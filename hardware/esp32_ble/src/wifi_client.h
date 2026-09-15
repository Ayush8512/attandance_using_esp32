#pragma once

#include <Arduino.h>
#include "ble_scanner.h"

class WifiClientApp {
public:
    void init();
    void maintainConnection();
    void reportDevice(const ScannedDevice& dev);
    bool isConnected();
};
