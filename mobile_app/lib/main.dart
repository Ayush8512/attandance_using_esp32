import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────────────────────────────────────

/// The iBeacon Proximity UUID broadcast by the classroom ESP32 beacon.
/// Must match the value flashed onto the ESP32.
const String kBeaconUUID = '12345678-1234-1234-1234-123456789abc';

/// Minimum RSSI (in dBm) to consider the student "inside the classroom".
/// Typical BLE range: -30 (very close) → -90 (far away).
const int kMinRssi = -75;

/// How long to scan for the beacon before giving up during manual scan.
const Duration kScanTimeout = Duration(seconds: 8);

/// FastAPI backend base URL.
/// • Android emulator → use 10.0.2.2 (maps to host localhost).
/// • Physical device  → use the machine's LAN IP, e.g. 192.168.1.42.
const String kApiBaseUrl = 'http://10.0.2.2:8000';

/// Local Push Notification Channel IDs
const String kNotificationChannelId = 'classroom_ble_channel';
const String kNotificationChannelName = 'Classroom Beacon Alerts';
const int kClassroomNotificationId = 888;
const int kForegroundServiceNotificationId = 889;

// ─────────────────────────────────────────────────────────────────────────────
//  Global State & Navigation
// ─────────────────────────────────────────────────────────────────────────────

late List<CameraDescription> _cameras;
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

/// Broadcast stream to trigger face scan screen when notification is tapped
final StreamController<bool> _openFaceScanTrigger =
    StreamController<bool>.broadcast();

// ─────────────────────────────────────────────────────────────────────────────
//  Local Push Notification Setup
// ─────────────────────────────────────────────────────────────────────────────

Future<void> initLocalNotifications() async {
  const AndroidInitializationSettings androidSettings =
      AndroidInitializationSettings('@mipmap/ic_launcher');

  const DarwinInitializationSettings darwinSettings =
      DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );

  const InitializationSettings initSettings = InitializationSettings(
    android: androidSettings,
    iOS: darwinSettings,
  );

  await _localNotifications.initialize(
    initSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      if (response.payload == 'open_face_scan') {
        _navigateToFaceScanScreen();
      }
    },
  );

  final androidPlugin = _localNotifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
  if (androidPlugin != null) {
    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        kNotificationChannelId,
        kNotificationChannelName,
        description: 'Notifies when ESP32 classroom beacon is detected nearby',
        importance: Importance.max,
        playSound: true,
      ),
    );
  }
}

/// Triggers the Local Push Notification:
/// "You are in the classroom. Tap to mark attendance."
Future<void> showClassroomNotification() async {
  const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
    kNotificationChannelId,
    kNotificationChannelName,
    channelDescription:
        'Notifies when ESP32 classroom beacon is detected nearby',
    importance: Importance.max,
    priority: Priority.high,
    icon: '@mipmap/ic_launcher',
    ticker: 'Classroom detected',
  );

  const DarwinNotificationDetails darwinDetails = DarwinNotificationDetails(
    presentAlert: true,
    presentBadge: true,
    presentSound: true,
  );

  const NotificationDetails notificationDetails = NotificationDetails(
    android: androidDetails,
    iOS: darwinDetails,
  );

  await _localNotifications.show(
    kClassroomNotificationId,
    'Smart Attendance',
    'You are in the classroom. Tap to mark attendance.',
    notificationDetails,
    payload: 'open_face_scan',
  );
}

void _navigateToFaceScanScreen() {
  debugPrint('[NOTIFICATION] Notification tapped -> Opening Face Scan Screen');
  _openFaceScanTrigger.add(true);
  navigatorKey.currentState?.push(
    MaterialPageRoute(
      builder: (context) => const FaceScanScreen(),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Background BLE Service
// ─────────────────────────────────────────────────────────────────────────────

Future<void> initializeBackgroundService() async {
  final service = FlutterBackgroundService();

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onBackgroundServiceStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: kNotificationChannelId,
      initialNotificationTitle: 'Smart Attendance Service',
      initialNotificationContent: 'Monitoring classroom beacons in background...',
      foregroundServiceNotificationId: kForegroundServiceNotificationId,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: true,
      onForeground: onBackgroundServiceStart,
      onBackground: onIosBackground,
    ),
  );
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void onBackgroundServiceStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });
    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Cooldown tracker to prevent spamming notifications continuously
  DateTime? lastNotificationTime;
  const Duration cooldown = Duration(minutes: 5);

  // Periodic background BLE scan loop (runs every 20 seconds)
  Timer.periodic(const Duration(seconds: 20), (timer) async {
    // If cooldown is active, skip scan cycle
    if (lastNotificationTime != null &&
        DateTime.now().difference(lastNotificationTime!) < cooldown) {
      return;
    }

    try {
      final isSupported = await FlutterBluePlus.isSupported;
      if (!isSupported) return;

      final adapterState = await FlutterBluePlus.adapterState.first;
      if (adapterState != BluetoothAdapterState.on) return;

      final targetUuid = kBeaconUUID.toLowerCase();
      bool foundBeacon = false;

      final Completer<bool> completer = Completer<bool>();
      StreamSubscription<List<ScanResult>>? subscription;

      subscription = FlutterBluePlus.onScanResults.listen((results) {
        for (final result in results) {
          if (completer.isCompleted) return;

          bool matched = false;

          // ── Method 1: Check advertised service UUIDs ──
          for (final uuid in result.advertisementData.serviceUuids) {
            if (uuid.toString().toLowerCase() == targetUuid) {
              matched = true;
              break;
            }
          }

          // ── Method 2: Parse iBeacon manufacturer data (Apple 0x004C) ──
          if (!matched) {
            final mfData = result.advertisementData.manufacturerData;
            if (mfData.containsKey(0x004C)) {
              final data = mfData[0x004C]!;
              if (data.length >= 18 && data[0] == 0x02 && data[1] == 0x15) {
                final uuidBytes = data.sublist(2, 18);
                final hex = uuidBytes
                    .map((b) => b.toRadixString(16).padLeft(2, '0'))
                    .join();
                final parsed =
                    '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
                    '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
                    '${hex.substring(20, 32)}';
                if (parsed.toLowerCase() == targetUuid) {
                  matched = true;
                }
              }
            }
          }

          // ── Method 3: Fallback device name ──
          if (!matched) {
            final name = result.advertisementData.advName;
            if (name.isNotEmpty && name.contains('Classroom_302_Beacon')) {
              matched = true;
            }
          }

          // Check RSSI proximity
          if (matched && result.rssi >= kMinRssi) {
            completer.complete(true);
          }
        }
      });

      await FlutterBluePlus.startScan(
        timeout: const Duration(seconds: 6),
        androidUsesFineLocation: true,
      );

      foundBeacon = await completer.future.timeout(
        const Duration(seconds: 7),
        onTimeout: () => false,
      );

      await FlutterBluePlus.stopScan();
      await subscription.cancel();

      if (foundBeacon) {
        lastNotificationTime = DateTime.now();
        await showClassroomNotification();
        service.invoke('beaconDetected', {'time': DateTime.now().toIso8601String()});
      }
    } catch (e) {
      debugPrint('[BackgroundService] Scan error: $e');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  App entry point
// ─────────────────────────────────────────────────────────────────────────────

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Enumerate cameras
  try {
    _cameras = await availableCameras();
  } catch (e) {
    _cameras = [];
    debugPrint('[CAMERA] Initialization error: $e');
  }

  // Initialize Local Notifications & Background Service
  await initLocalNotifications();
  await initializeBackgroundService();

  runApp(const AttendanceApp());
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root widget
// ─────────────────────────────────────────────────────────────────────────────

class AttendanceApp extends StatelessWidget {
  const AttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Smart Attendance',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Colors.indigo,
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      home: const AttendanceScreen(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main attendance screen
// ─────────────────────────────────────────────────────────────────────────────

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  StreamSubscription<bool>? _notificationSub;

  @override
  void initState() {
    super.initState();
    // Request required permissions on app startup
    _requestAllPermissions();

    // Listen for notification taps
    _notificationSub = _openFaceScanTrigger.stream.listen((shouldOpen) {
      if (shouldOpen && mounted) {
        // Navigation handled globally via navigatorKey
      }
    });
  }

  @override
  void dispose() {
    _notificationSub?.cancel();
    super.dispose();
  }

  Future<void> _requestAllPermissions() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.locationWhenInUse,
      Permission.locationAlways,
      Permission.camera,
      Permission.notification,
    ].request();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart Attendance'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              const Spacer(),
              Icon(
                Icons.bluetooth_searching,
                size: 96,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                'Background Beacon Scanning Active',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'When you walk into the classroom, the app detects the ESP32 beacon and sends a notification:\n\n'
                '“You are in the classroom. Tap to mark attendance.”\n\n'
                'Tapping the notification opens the Face Scan Screen directly.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.grey.shade700,
                  height: 1.4,
                ),
              ),
              const Spacer(flex: 2),

              // Button to manually open Face Scan Screen
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const FaceScanScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.camera_alt, size: 26),
                  label: const Text(
                    'Open Face Scan Screen',
                    style: TextStyle(fontSize: 16),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Simulation helper button for testing notification
              OutlinedButton.icon(
                onPressed: () async {
                  await showClassroomNotification();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Test notification sent! Tap it to open Face Scan.'),
                        duration: Duration(seconds: 3),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.notifications_active),
                label: const Text('Simulate Beacon Notification'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Face Scan Screen (opened directly on notification tap)
// ─────────────────────────────────────────────────────────────────────────────

class FaceScanScreen extends StatefulWidget {
  const FaceScanScreen({super.key});

  @override
  State<FaceScanScreen> createState() => _FaceScanScreenState();
}

class _FaceScanScreenState extends State<FaceScanScreen> {
  CameraController? _cameraController;
  bool _isCameraReady = false;
  bool _isProcessing = false;
  String _statusMessage = 'Align your face inside the frame and tap Capture.';
  Color _statusColor = Colors.black87;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    if (_cameras.isEmpty) {
      try {
        _cameras = await availableCameras();
      } catch (e) {
        _setStatus('No cameras available on this device.', Colors.red);
        return;
      }
    }

    CameraDescription? frontCamera;
    for (final cam in _cameras) {
      if (cam.lensDirection == CameraLensDirection.front) {
        frontCamera = cam;
        break;
      }
    }
    frontCamera ??= _cameras.isNotEmpty ? _cameras.first : null;

    if (frontCamera == null) {
      _setStatus('No front camera found.', Colors.red);
      return;
    }

    final controller = CameraController(
      frontCamera,
      ResolutionPreset.medium,
      enableAudio: false,
    );

    try {
      await controller.initialize();
      if (!mounted) return;
      setState(() {
        _cameraController = controller;
        _isCameraReady = true;
      });
    } catch (e) {
      _setStatus('Camera error: $e', Colors.red);
    }
  }

  void _setStatus(String message, Color color) {
    if (!mounted) return;
    setState(() {
      _statusMessage = message;
      _statusColor = color;
    });
  }

  Future<void> _captureAndVerify() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      _setStatus('Camera is not ready.', Colors.red);
      return;
    }

    setState(() => _isProcessing = true);
    _setStatus('Capturing photo…', Colors.indigo);

    try {
      final XFile image = await _cameraController!.takePicture();
      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}/face_scan_${DateTime.now().millisecondsSinceEpoch}.jpg';
      await File(image.path).copy(path);

      _setStatus('Checking time window & verifying face…', Colors.indigo);

      final uri = Uri.parse('$kApiBaseUrl/verify');
      final request = http.MultipartRequest('POST', uri)
        ..files.add(await http.MultipartFile.fromPath('photo', path));

      final streamed = await request.send().timeout(
            const Duration(seconds: 15),
          );
      final response = await http.Response.fromStream(streamed);
      final Map<String, dynamic> data =
          jsonDecode(response.body) as Map<String, dynamic>;

      debugPrint('[VERIFY API] Status ${response.statusCode}: ${response.body}');

      if (response.statusCode == 200) {
        final name = data['name'] ?? '';
        final rollNo = data['roll_no'] ?? '';
        final subject = data['subject'] ?? '';
        _setStatus(
          '✅ Attendance Marked!\n\nName: $name\nRoll No: $rollNo\nSubject: $subject',
          Colors.green.shade800,
        );
      } else if (response.statusCode == 403) {
        // Strict Time Limit Exceeded error from FastAPI backend
        final detail = data['detail'] ?? 'Time limit exceeded.';
        _setStatus('❌ Rejection:\n$detail', Colors.red.shade800);
      } else {
        final detail = data['detail'] ?? 'Verification failed (${response.statusCode})';
        _setStatus('❌ $detail', Colors.red.shade800);
      }

      try {
        await File(path).delete();
      } catch (_) {}
    } on SocketException {
      _setStatus(
        '❌ Connection error:\nCannot reach backend at $kApiBaseUrl',
        Colors.red.shade800,
      );
    } on TimeoutException {
      _setStatus('❌ Request timed out. Try again.', Colors.red.shade800);
    } catch (e) {
      _setStatus('❌ Error: $e', Colors.red.shade800);
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Face Scan Attendance'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 12),

            // Camera preview with face guide overlay
            Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(20),
                ),
                clipBehavior: Clip.antiAlias,
                child: _isCameraReady && _cameraController != null
                    ? Stack(
                        alignment: Alignment.center,
                        children: [
                          CameraPreview(_cameraController!),
                          // Face Oval Overlay
                          Container(
                            width: 240,
                            height: 320,
                            decoration: BoxDecoration(
                              shape: BoxShape.rectangle,
                              borderRadius: BorderRadius.circular(120),
                              border: Border.all(
                                color: Colors.white.withAlpha(200),
                                width: 3,
                              ),
                            ),
                          ),
                        ],
                      )
                    : const Center(
                        child: CircularProgressIndicator(color: Colors.white),
                      ),
              ),
            ),

            const SizedBox(height: 16),

            // Status message card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Text(
                  _statusMessage,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: _statusColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Action Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton.icon(
                  onPressed: _isProcessing ? null : _captureAndVerify,
                  icon: _isProcessing
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.camera, size: 28),
                  label: Text(
                    _isProcessing ? 'Verifying…' : 'Capture & Verify',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
