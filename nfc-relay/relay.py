"""
NFC 중계 프로그램 — ACR1252U USB 리더기용
학원 PC에서 실행. NFC 카드 터치 감지 → classmanager.site API 호출 → 출석 처리

사용법:
  1. pip install pyscard requests
  2. ACR1252U USB 리더기 연결
  3. python relay.py --url https://classmanager.site --token <원장_JWT_토큰>

테스트 (리더기 없이):
  python relay.py --test
"""

import argparse
import sys
import time

import requests

# API 엔드포인트
CHECK_IN_URL = "/api/attendance/check-in/nfc"


def get_card_uid_pyscard():
    """pyscard로 NFC 카드 UID 읽기 (ACR122U, ACR1252U 호환)"""
    from smartcard.CardMonitoring import CardMonitor, CardObserver
    from smartcard.util import toHexString
    import threading

    uid_event = threading.Event()
    uid_result = [None]

    class Observer(CardObserver):
        def update(self, observable, actions):
            added, removed = actions
            for card in added:
                connection = card.createConnection()
                try:
                    connection.connect()
                    # GET UID command (works with most NFC tags)
                    response, sw1, sw2 = connection.transmit([0xFF, 0xCA, 0x00, 0x00, 0x00])
                    if sw1 == 0x90 and sw2 == 0x00:
                        uid_result[0] = toHexString(response).replace(" ", "")
                        uid_event.set()
                except Exception as e:
                    print(f"카드 읽기 실패: {e}")
                finally:
                    try:
                        connection.disconnect()
                    except Exception:
                        pass

    monitor = CardMonitor()
    observer = Observer()
    monitor.addObserver(observer)

    uid_event.wait()
    monitor.deleteObserver(observer)
    return uid_result[0]


def check_in(base_url: str, token: str, nfc_uid: str) -> dict:
    """서버에 출석 요청"""
    url = f"{base_url.rstrip('/')}{CHECK_IN_URL}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.post(url, json={"nfc_uid": nfc_uid}, headers=headers, timeout=5)
        return resp.json()
    except requests.RequestException as e:
        return {"ok": False, "message": f"서버 연결 실패: {e}"}


def run_relay(base_url: str, token: str):
    """메인 루프 — 카드 감지 → API 호출 반복"""
    print("=" * 50)
    print("  NFC 출석 중계 프로그램")
    print(f"  서버: {base_url}")
    print("=" * 50)
    print()
    print("NFC 카드를 리더기에 터치하세요...")
    print("종료: Ctrl+C")
    print()

    last_uid = None
    last_time = 0

    while True:
        try:
            uid = get_card_uid_pyscard()
            if uid is None:
                continue

            # 같은 카드 3초 내 중복 방지
            now = time.time()
            if uid == last_uid and now - last_time < 3:
                continue
            last_uid = uid
            last_time = now

            print(f"[카드 감지] UID: {uid}")
            result = check_in(base_url, token, uid)

            if result.get("ok"):
                name = result.get("student_name", "?")
                status = result.get("status", "present")
                if status == "already_checked":
                    print(f"  → {name} (이미 출석됨)")
                else:
                    print(f"  → ✅ {name} 출석 완료!")
            else:
                msg = result.get("detail") or result.get("message", "알 수 없는 오류")
                print(f"  → ❌ {msg}")

            print()

        except KeyboardInterrupt:
            print("\n종료합니다.")
            sys.exit(0)
        except Exception as e:
            print(f"오류: {e}")
            time.sleep(1)


def run_test():
    """리더기 없이 테스트"""
    print("테스트 모드 — 가상 NFC UID로 API 호출")
    print()

    base_url = input("서버 URL (기본: https://classmanager.site): ").strip()
    if not base_url:
        base_url = "https://classmanager.site"

    token = input("JWT 토큰 (빈칸이면 없이 요청): ").strip()

    while True:
        uid = input("\nNFC UID 입력 (종료: q): ").strip()
        if uid.lower() == 'q':
            break

        result = check_in(base_url, token, uid)
        print(f"  응답: {result}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NFC 출석 중계 프로그램")
    parser.add_argument("--url", default="https://classmanager.site", help="서버 URL")
    parser.add_argument("--token", default="", help="원장 JWT 토큰")
    parser.add_argument("--test", action="store_true", help="리더기 없이 테스트 모드")
    args = parser.parse_args()

    if args.test:
        run_test()
    else:
        run_relay(args.url, args.token)
