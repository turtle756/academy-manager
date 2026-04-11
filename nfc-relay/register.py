"""
NFC 카드 등록 도구 — ACR1252U용
리더기에 카드 터치 → 학생 목록 표시 → 번호 선택 → 등록

사용법:
  python register.py --token <JWT> --academy 1
"""

import argparse
import sys
import time
import urllib.request
import urllib.parse
import json as json_lib

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from relay import establish_context, list_readers, connect_card, get_uid, SCARD_S_SUCCESS, SCARD_LEAVE_CARD
import ctypes
winscard = ctypes.windll.LoadLibrary("WinSCard.dll")


def api_request(base_url, path, token, academy_id, method="GET", data=None):
    url = f"{base_url.rstrip('/')}{path}"
    body = None
    if data:
        body = json_lib.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    if body:
        req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("X-Academy-Id", str(academy_id))
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json_lib.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return {"error": json_lib.loads(e.read().decode("utf-8")).get("detail", f"HTTP {e.code}")}
        except Exception:
            return {"error": f"HTTP {e.code}"}


def wait_for_card(ctx, reader):
    """카드 터치 대기 — UID 반환"""
    last_uid = None
    while True:
        card, protocol, rv = connect_card(ctx, reader)
        if rv == SCARD_S_SUCCESS:
            uid = get_uid(card, protocol)
            winscard.SCardDisconnect(card, SCARD_LEAVE_CARD)
            if uid and uid != last_uid:
                return uid
            last_uid = uid
        else:
            last_uid = None
        time.sleep(0.2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="https://classmanager.site")
    parser.add_argument("--token", required=True)
    parser.add_argument("--academy", required=True)
    args = parser.parse_args()

    print("=" * 60)
    print("  NFC 카드 등록 도구")
    print("=" * 60)
    print()

    # 1. 학생 목록 받기
    print("학생 목록 불러오는 중...")
    students = api_request(args.url, "/api/students", args.token, args.academy)
    if isinstance(students, dict) and "error" in students:
        print(f"❌ {students['error']}")
        sys.exit(1)

    if not students:
        print("❌ 등록된 학생이 없습니다.")
        sys.exit(1)

    # 2. 리더기 연결
    ctx = establish_context()
    readers = list_readers(ctx)
    reader = None
    for r in readers:
        if "PICC" in r:
            reader = r
            break
    if not reader:
        print("❌ NFC 리더기를 찾을 수 없습니다.")
        sys.exit(1)

    print(f"✓ 리더기: {reader}")
    print()

    while True:
        # 학생 목록 출력
        print("\n" + "=" * 60)
        print("학생 목록:")
        for i, s in enumerate(students, 1):
            nfc = s.get("nfc_uid")
            status = f"🟢 등록됨 ({nfc})" if nfc else "⚪ 미등록"
            print(f"  {i:2d}. {s['name']:<15} {status}")
        print("   q. 종료")
        print()

        choice = input("등록할 학생 번호 선택: ").strip()
        if choice.lower() == 'q':
            break

        try:
            idx = int(choice) - 1
            if idx < 0 or idx >= len(students):
                print("❌ 잘못된 번호입니다.")
                continue
        except ValueError:
            print("❌ 숫자를 입력하세요.")
            continue

        student = students[idx]
        print(f"\n🟢 {student['name']} 선택됨")
        print("NFC 카드를 리더기에 터치하세요...")

        uid = wait_for_card(ctx, reader)
        print(f"[카드 감지] UID: {uid}")

        # 3. 등록 API 호출
        result = api_request(
            args.url,
            f"/api/students/{student['id']}/register-nfc?nfc_uid={uid}",
            args.token, args.academy, method="POST"
        )
        if "error" in result:
            print(f"❌ 등록 실패: {result['error']}")
        else:
            print(f"✅ {student['name']} 등록 완료!")
            # 목록 새로고침
            students = api_request(args.url, "/api/students", args.token, args.academy)

        # 3초 대기 (같은 카드 중복 감지 방지)
        time.sleep(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n종료합니다.")
