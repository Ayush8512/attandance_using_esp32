# Smart Attendance System (BLE + Face Recognition + Strict Time Window)

An end-to-end intelligent attendance automation system featuring **Background BLE beacon detection**, **Local Push Notifications**, **Facial Recognition**, and **Strict Timetable Windows**.

---

## 🌟 System Architecture

```
                                  ┌───────────────────────────┐
                                  │   ESP32 Classroom Beacon  │
                                  │   (UUID: e2c56db5-...)    │
                                  └─────────────┬─────────────┘
                                                │ BLE Advertisement
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Flutter Mobile App                              │
│                                                                             │
│  [Background Service] ──(Detects Beacon RSSI >= -75dBm)──► [Push Notif]    │
│                                                                   │         │
│                                                                   ▼         │
│  [Server: /verify] ◄──(Captures Selfie & Sends POST)── [Face Scan Camera]   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP POST /verify (Live Selfie)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI Python Backend                            │
│                                                                             │
│  1. Strict Time Gate: Checks server time vs timetable (10-min window)      │
│  2. Face Match: Compares 128-d encoding with registered SQLite profiles     │
│  3. Attendance: Marks 'Present' in SQLite & prevents duplicate entries      │
│  4. Reporting: Generates Excel & emails summary on class completion        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Serves Static Web App
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Modern Web Dashboard                             │
│                                                                             │
│  • Timetable & 10-Minute Windows Management                                 │
│  • Student Registration with Webcam / Photo Upload                          │
│  • Live Classroom Attendance Status                                         │
│  • Attendance Records Filter & 1-Click CSV Export                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Background BLE Scanning & Local Notifications**:
   - Continuous foreground service detects ESP32 classroom beacon proximity (`RSSI >= -75 dBm`).
   - Triggers notification: *"You are in the classroom. Tap to mark attendance."*
   - Direct tap navigates immediately into Face Scan screen.

2. **Strict 10-Minute Attendance Window**:
   - Backend evaluates server time **before** running face recognition algorithms.
   - If scan time is past the allowed window (e.g. 10:11 AM for 10:00 AM class), returns `403 Forbidden` with *"Time limit exceeded"*.

3. **Web Dashboard & Timetable Manager**:
   - Clean dark-theme web UI served directly at `http://localhost:8000`.
   - Add/edit/delete classes, custom start times, and allowed attendance windows.
   - Live session indicator and one-click Excel report mailing.

---

## 🛠️ Project Structure

```
RFID/
├── backend/                  # FastAPI backend server
│   ├── main.py              # REST API, SQLite models, face recognition, timetable
│   ├── test_time_window.py  # Unit tests for strict time window & verify endpoints
│   └── requirements.txt     # Python dependencies
├── frontend/                 # Single Page Web Dashboard
│   ├── index.html           # Tailwind CSS & layout entry
│   ├── css/style.css        # Custom styles & dark theme
│   └── js/                  # Vanilla JS SPA router, API client & pages
├── mobile_app/               # Flutter Android mobile application
│   ├── lib/main.dart        # Background BLE service, notifications & face camera
│   ├── pubspec.yaml         # Flutter dependencies
│   └── android/             # Native Android configuration
├── hardware/                 # ESP32 Arduino / C++ firmware
└── SmartAttendance.apk       # Standalone Release Android APK (~46.5 MB)
```

---

## 🚦 Quick Start Guide

### 1. Start the Backend & Web Dashboard
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Access dashboard at `http://localhost:8000`.

### 2. Run / Build Flutter Mobile App
```bash
cd mobile_app
flutter pub get
flutter build apk --release
```
Standalone APK will be generated at `build/app/outputs/flutter-apk/app-release.apk`.
