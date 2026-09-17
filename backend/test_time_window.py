"""
Unit and integration tests for strict 10-minute attendance time window.
Tests:
1. Time window validation function (check_attendance_window)
2. Database timetable retrieval
3. /verify endpoint behavior:
   - Within 10-minute window -> Allowed (reaches face matching)
   - After 10-minute window (e.g. 10:11 for 10:00 class) -> Rejected with 403 "Time limit exceeded"
   - No scheduled class -> Rejected with 403 "Time limit exceeded"
"""

import io
import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Ensure backend directory is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
import main
from main import app, check_attendance_window, ATTENDANCE_WINDOW_MINUTES


class TestStrictTimeWindow(unittest.TestCase):
    def setUp(self):
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    def test_check_attendance_window_within_limit(self):
        """Test scanning at 10:05 AM for a 10:00 AM class (within 10 minutes)."""
        class_info = {
            "hour": 10,
            "subject": "Physics",
            "teacher_email": "verma@college.edu",
            "start_minute": 0,
            "allowed_window_minutes": 10,
        }
        # 10:05 AM
        scan_time = datetime(2026, 9, 15, 10, 5, 0)
        is_allowed, err, window_end = check_attendance_window(class_info, scan_time)
        self.assertTrue(is_allowed)
        self.assertEqual(err, "")
        self.assertIn("10:10", window_end)

    def test_check_attendance_window_exact_boundary(self):
        """Test scanning at exactly 10:10 AM for a 10:00 AM class."""
        class_info = {
            "hour": 10,
            "subject": "Physics",
            "teacher_email": "verma@college.edu",
            "start_minute": 0,
            "allowed_window_minutes": 10,
        }
        # Exactly 10:10:00 AM
        scan_time = datetime(2026, 9, 15, 10, 10, 0)
        is_allowed, err, window_end = check_attendance_window(class_info, scan_time)
        self.assertTrue(is_allowed)

    def test_check_attendance_window_exceeded(self):
        """Test scanning at 10:11 AM for a 10:00 AM class (1 minute past window)."""
        class_info = {
            "hour": 10,
            "subject": "Physics",
            "teacher_email": "verma@college.edu",
            "start_minute": 0,
            "allowed_window_minutes": 10,
        }
        # 10:11 AM
        scan_time = datetime(2026, 9, 15, 10, 11, 0)
        is_allowed, err, window_end = check_attendance_window(class_info, scan_time)
        self.assertFalse(is_allowed)
        self.assertIn("Time limit exceeded", err)
        self.assertIn("10:10", err)

    def test_check_attendance_window_before_start(self):
        """Test scanning before class start time (e.g. 09:55 AM for 10:00 AM class)."""
        class_info = {
            "hour": 10,
            "subject": "Physics",
            "teacher_email": "verma@college.edu",
            "start_minute": 0,
            "allowed_window_minutes": 10,
        }
        scan_time = datetime(2026, 9, 15, 9, 55, 0)
        is_allowed, err, window_end = check_attendance_window(class_info, scan_time)
        self.assertFalse(is_allowed)
        self.assertIn("Class has not started yet", err)

    def test_verify_api_time_limit_exceeded(self):
        """
        Verify /verify endpoint strictly rejects when time is past 10-minute window
        with 403 'Time limit exceeded' even before matching face.
        """
        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(73, 109, 137))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="JPEG")
        img_bytes.seek(0)

        # Mock datetime to 10:15 AM on Monday (Class is Physics at 10:00 AM, window ended 10:10 AM)
        mock_now = datetime(2026, 9, 14, 10, 15, 0)  # 2026-09-14 is a Monday
        with patch("main.datetime") as mock_datetime:
            mock_datetime.now.return_value = mock_now
            mock_datetime.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)

            response = self.client.post(
                "/verify",
                files={"photo": ("test.jpg", img_bytes.getvalue(), "image/jpeg")},
            )

            self.assertEqual(response.status_code, 403)
            data = response.json()
            self.assertIn("detail", data)
            self.assertIn("Time limit exceeded", data["detail"])
            print("\n[TEST OK] /verify correctly rejected with 403 and:", data["detail"])

    def test_verify_api_within_window(self):
        """
        Verify /verify endpoint proceeds past time check when within 10-minute window (e.g. 10:05 AM).
        """
        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(73, 109, 137))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="JPEG")
        img_bytes.seek(0)

        # 1. Register student
        dummy_encoding = [0.1] * 128
        with patch("main.extract_face_encoding", return_value=dummy_encoding):
            reg_resp = self.client.post(
                "/register",
                data={"roll_no": "ROLL_TEST_101", "name": "Time Test Student"},
                files={"photo": ("test.jpg", img_bytes.getvalue(), "image/jpeg")},
            )
            self.assertEqual(reg_resp.status_code, 200)

            # 2. Verify during allowed window (10:05 AM Monday) -> Should succeed!
            mock_now_valid = datetime(2026, 9, 14, 10, 5, 0)
            with patch("main.datetime") as mock_datetime:
                mock_datetime.now.return_value = mock_now_valid
                mock_datetime.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)

                response = self.client.post(
                    "/verify",
                    files={"photo": ("test.jpg", img_bytes.getvalue(), "image/jpeg")},
                )

                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertIn(data["status"], ["success", "already_marked"])
                print(f"\n[TEST OK] Verified within window: status={data['status']}, roll_no={data['roll_no']}")

        # 3. Verify late after 10-minute window (10:15 AM Monday) -> Should be rejected with 403 "Time limit exceeded"
        mock_now_late = datetime(2026, 9, 14, 10, 15, 0)
        with patch("main.datetime") as mock_datetime:
            mock_datetime.now.return_value = mock_now_late
            mock_datetime.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)

            late_response = self.client.post(
                "/verify",
                files={"photo": ("test.jpg", img_bytes.getvalue(), "image/jpeg")},
            )

            self.assertEqual(late_response.status_code, 403)
            late_data = late_response.json()
            self.assertIn("Time limit exceeded", late_data["detail"])
            print(f"[TEST OK] Rejected after window: status=403, detail={late_data['detail']}")

    def test_timetable_endpoint_includes_windows(self):
        """Verify /timetable endpoint returns start_minute and allowed_window_minutes."""
        response = self.client.get("/timetable")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("timetable", data)
        self.assertTrue(len(data["timetable"]) > 0)
        first_entry = data["timetable"][0]
        self.assertIn("start_minute", first_entry)
        self.assertIn("allowed_window_minutes", first_entry)
        self.assertEqual(first_entry["allowed_window_minutes"], 10)
        self.assertIn("attendance_window", first_entry)
        print("\n[TEST OK] /timetable returns window metadata:", first_entry["attendance_window"])


if __name__ == "__main__":
    unittest.main()
