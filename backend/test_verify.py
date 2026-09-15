"""
Test script for the /verify endpoint.

Usage:
    # Test with a real image file:
    python test_verify.py path/to/photo.jpg

    # Test with an auto-generated dummy image (requires Pillow):
    python test_verify.py

The script also tests /register first (so there's at least one student
in the DB to match against), then calls /verify with the same image.
"""

import sys
import os
import requests

BASE_URL = os.getenv("API_URL", "http://localhost:8000")


def create_dummy_image() -> bytes:
    """Generate a minimal valid JPEG in-memory (no face — expects a 400)."""
    try:
        from PIL import Image
        import io

        img = Image.new("RGB", (200, 200), color=(128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()
    except ImportError:
        # Fallback: 1×1 white JPEG (smallest valid JPEG possible)
        return (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01"
            b"\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06"
            b"\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b"
            b"\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c"
            b"\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0"
            b"\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4"
            b"\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06"
            b"\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03"
            b"\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02"
            b"\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07\"q\x142\x81"
            b"\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16"
            b"\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJSTUVWXYZcdefghij"
            b"stuvwxyz\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94"
            b"\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8"
            b"\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2\xc3"
            b"\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7"
            b"\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea"
            b"\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00"
            b"\x08\x01\x01\x00\x00?\x00T\xdb\xe3\x8c\xa5L\xa2\x8a("
            b"\x03\xff\xd9"
        )


def print_result(label: str, resp: requests.Response) -> None:
    """Pretty-print an API response."""
    status = "✅" if resp.ok else "❌"
    print(f"\n{status}  {label}")
    print(f"    Status : {resp.status_code}")
    try:
        body = resp.json()
        for k, v in body.items():
            print(f"    {k:10s}: {v}")
    except Exception:
        print(f"    Body   : {resp.text[:300]}")


def main():
    image_path = sys.argv[1] if len(sys.argv) > 1 else None

    # ── Resolve image bytes ──
    if image_path:
        if not os.path.isfile(image_path):
            print(f"File not found: {image_path}")
            sys.exit(1)
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        filename = os.path.basename(image_path)
        print(f"Using image: {image_path}  ({len(image_bytes)} bytes)")
    else:
        image_bytes = create_dummy_image()
        filename = "dummy.jpg"
        print(f"No image path provided — using auto-generated dummy image ({len(image_bytes)} bytes)")

    # ── 1. Health check ──
    print("\n" + "=" * 50)
    print("1 · Health check  GET /")
    print("=" * 50)
    try:
        r = requests.get(f"{BASE_URL}/")
        print_result("GET /", r)
    except requests.ConnectionError:
        print(f"\n❌  Cannot connect to {BASE_URL}")
        print("    Make sure the FastAPI server is running:")
        print("    uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        sys.exit(1)

    # ── 2. Register a test student ──
    print("\n" + "=" * 50)
    print("2 · Register test student  POST /register")
    print("=" * 50)
    r = requests.post(
        f"{BASE_URL}/register",
        data={"roll_no": "TEST001", "name": "Test Student"},
        files={"photo": (filename, image_bytes, "image/jpeg")},
    )
    print_result("POST /register", r)

    # ── 3. Verify with the same image ──
    print("\n" + "=" * 50)
    print("3 · Verify attendance  POST /verify")
    print("=" * 50)
    r = requests.post(
        f"{BASE_URL}/verify",
        files={"photo": (filename, image_bytes, "image/jpeg")},
    )
    print_result("POST /verify", r)

    # ── 4. Check attendance records ──
    print("\n" + "=" * 50)
    print("4 · Get attendance  GET /attendance")
    print("=" * 50)
    r = requests.get(f"{BASE_URL}/attendance")
    print_result("GET /attendance", r)

    print("\n" + "=" * 50)
    print("Done.")
    print("=" * 50)


if __name__ == "__main__":
    main()
