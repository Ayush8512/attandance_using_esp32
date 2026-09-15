/*
 * ESP32 Classroom BLE Beacon Transmitter
 * 
 * This code turns the ESP32 into a BLE Classroom Beacon broadcasting the UUID:
 * 12345678-1234-1234-1234-123456789abc
 * 
 * When students enter the classroom with the Android App, their phone detects this
 * beacon and triggers the attendance notification:
 * "You are in the classroom. Tap to mark attendance."
 */

#include "BLEDevice.h"
#include "BLEUtils.h"
#include "BLEServer.h"
#include "BLEBeacon.h"
#include "esp_sleep.h"

#define BEACON_UUID           "12345678-1234-1234-1234-123456789abc"
#define BEACON_NAME           "SAS_Classroom_Beacon"
#define LED_PIN               2

BLEAdvertising *pAdvertising;

void setBeacon() {
    BLEBeacon oBeacon = BLEBeacon();
    oBeacon.setManufacturerId(0x4C00); // Apple iBeacon format
    
    BLEUUID bleUUID = BLEUUID(BEACON_UUID);
    bleUUID = bleUUID.to128();
    oBeacon.setProximityUUID(bleUUID);
    oBeacon.setMajor(1);   // Room / Classroom number (e.g. 1)
    oBeacon.setMinor(101); // Sub-room or section (e.g. 101)
    oBeacon.setSignalPower(-59); // Measured power at 1 meter

    BLEAdvertisementData oAdvertisementData = BLEAdvertisementData();
    BLEAdvertisementData oScanResponseData = BLEAdvertisementData();

    oAdvertisementData.setFlags(0x04); // BR_EDR_NOT_SUPPORTED 0x04

    std::string strServiceData = "";
    strServiceData += (char)26;     // Length
    strServiceData += (char)0xFF;   // Type: Manufacturer Specific
    strServiceData += oBeacon.getData();
    oAdvertisementData.addData(strServiceData);

    oScanResponseData.setName(BEACON_NAME);

    pAdvertising->setAdvertisementData(oAdvertisementData);
    pAdvertising->setScanResponseData(oScanResponseData);
}

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH);

    Serial.println("\n==========================================");
    Serial.println("  Smart Attendance - Classroom BLE Beacon ");
    Serial.println("==========================================");
    Serial.printf("Broadcasting UUID : %s\n", BEACON_UUID);
    Serial.printf("Beacon Name       : %s\n", BEACON_NAME);
    Serial.println("Status            : Active & Transmitting");
    Serial.println("==========================================\n");

    // Initialize BLE Device
    BLEDevice::init(BEACON_NAME);
    pAdvertising = BLEDevice::getAdvertising();

    setBeacon();

    // Start advertising
    pAdvertising->start();
    Serial.println("BLE Beacon is now LIVE. Students' phones will detect it automatically.");
}

void loop() {
    // Blink LED every 3 seconds to indicate healthy beacon transmission
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(2900);
}
