"""
NFC 중계 프로그램 — ACR1252U / ACR122U USB 리더기용
Windows PC/SC API를 ctypes로 직접 호출 (별도 라이브러리 불필요)

사용법:
  python relay.py --url https://classmanager.site --token <JWT> --academy <ID>

테스트 (서버 없이 카드 UID만 읽기):
  python relay.py --test
"""

import argparse
import ctypes
import sys

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
import time
import urllib.request
import json as json_lib
from ctypes import c_ulong, c_void_p, c_char_p, byref, create_string_buffer, Structure, POINTER

# PC/SC constants
SCARD_SCOPE_USER = 0
SCARD_SHARE_SHARED = 2
SCARD_PROTOCOL_T0 = 1
SCARD_PROTOCOL_T1 = 2
SCARD_LEAVE_CARD = 0
SCARD_S_SUCCESS = 0
SCARD_E_NO_READERS_AVAILABLE = 0x8010002E
SCARD_E_NO_SMARTCARD = 0x8010000C
SCARD_W_REMOVED_CARD = 0x80100069

# Load WinSCard.dll
winscard = ctypes.windll.LoadLibrary("WinSCard.dll")


class SCARD_IO_REQUEST(Structure):
    _fields_ = [("dwProtocol", c_ulong), ("cbPciLength", c_ulong)]


def establish_context():
    ctx = c_void_p()
    rv = winscard.SCardEstablishContext(SCARD_SCOPE_USER, None, None, byref(ctx))
    if rv != SCARD_S_SUCCESS:
        raise RuntimeError(f"SCardEstablishContext failed: {hex(rv)}")
    return ctx


def list_readers(ctx):
    length = c_ulong()
    rv = winscard.SCardListReadersA(ctx, None, None, byref(length))
    if rv != SCARD_S_SUCCESS or length.value == 0:
        return []
    buf = create_string_buffer(length.value)
    rv = winscard.SCardListReadersA(ctx, None, buf, byref(length))
    if rv != SCARD_S_SUCCESS:
        return []
    # Multi-string parsing (mbcs: Windows 시스템 코드페이지, 한글 환경 대응)
    readers = []
    current = b""
    for i in range(length.value):
        if buf[i] == b"\x00":
            if current:
                try:
                    readers.append(current.decode("mbcs"))
                except (UnicodeDecodeError, LookupError):
                    readers.append(current.decode("utf-8", errors="replace"))
                current = b""
        else:
            current += buf[i]
    return readers


def connect_card(ctx, reader_name):
    card = c_void_p()
    protocol = c_ulong()
    # mbcs: Windows 시스템 코드페이지 (한글 환경 포함) 대응
    try:
        encoded = reader_name.encode("mbcs")
    except (UnicodeEncodeError, LookupError):
        encoded = reader_name.encode("utf-8", errors="replace")
    rv = winscard.SCardConnectA(
        ctx, encoded, SCARD_SHARE_SHARED,
        SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, byref(card), byref(protocol)
    )
    return card, protocol, rv


def get_uid(card, protocol):
    # GET DATA command for UID: FF CA 00 00 00
    send_buf = (ctypes.c_ubyte * 5)(0xFF, 0xCA, 0x00, 0x00, 0x00)
    recv_buf = (ctypes.c_ubyte * 256)()
    recv_len = c_ulong(256)

    send_pci = SCARD_IO_REQUEST(protocol.value, 8)

    rv = winscard.SCardTransmit(
        card, byref(send_pci), send_buf, 5,
        None, recv_buf, byref(recv_len)
    )
    if rv != SCARD_S_SUCCESS or recv_len.value < 2:
        return None

    # Last 2 bytes are SW1 SW2 (should be 90 00 for success)
    uid_bytes = bytes(recv_buf[:recv_len.value - 2])
    sw1 = recv_buf[recv_len.value - 2]
    sw2 = recv_buf[recv_len.value - 1]

    if sw1 == 0x90 and sw2 == 0x00:
        return uid_bytes.hex().upper()
    return None


def check_in(base_url: str, token: str, academy_id: str, nfc_uid: str):
    url = f"{base_url.rstrip('/')}/api/attendance/check-in/nfc"
    data = json_lib.dumps({"nfc_uid": nfc_uid}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if academy_id:
        req.add_header("X-Academy-Id", academy_id)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json_lib.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json_lib.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "message": f"HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def run(base_url: str, token: str, academy_id: str, test_only: bool = False):
    print("=" * 60)
    print("  NFC 출석 중계 프로그램 (ACR1252U)")
    if not test_only:
        print(f"  서버: {base_url}")
    else:
        print("  테스트 모드 (서버 호출 없음)")
    print("=" * 60)

    try:
        ctx = establish_context()
    except Exception as e:
        print(f"❌ PC/SC 초기화 실패: {e}")
        sys.exit(1)

    readers = list_readers(ctx)
    if not readers:
        print("❌ NFC 리더기를 찾을 수 없습니다. USB 연결을 확인하세요.")
        sys.exit(1)

    reader = readers[0]
    # ACR1252U는 보통 "PICC 0" 이라는 이름의 인터페이스를 씀
    for r in readers:
        if "PICC" in r:
            reader = r
            break
    print(f"✓ 리더기 감지: {reader}")
    print()
    print("NFC 카드를 리더기에 터치하세요...")
    print("종료: Ctrl+C")
    print()

    last_uid = None
    last_time = 0.0

    try:
        while True:
            card, protocol, rv = connect_card(ctx, reader)
            if rv == SCARD_S_SUCCESS:
                uid = get_uid(card, protocol)
                winscard.SCardDisconnect(card, SCARD_LEAVE_CARD)

                if uid:
                    now = time.time()
                    if uid == last_uid and now - last_time < 2:
                        time.sleep(0.2)
                        continue
                    last_uid = uid
                    last_time = now

                    print(f"[카드] UID: {uid}")
                    if not test_only:
                        result = check_in(base_url, token, academy_id, uid)
                        if result.get("ok"):
                            name = result.get("student_name", "?")
                            status = result.get("status", "present")
                            if status == "already_checked":
                                print(f"  → ⚠️  {name} (이미 출석됨)")
                            else:
                                print(f"  → ✅ {name} 출석 완료!")
                        else:
                            msg = result.get("detail") or result.get("message", "알 수 없는 오류")
                            print(f"  → ❌ {msg}")
                    print()
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n종료합니다.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NFC 출석 중계 프로그램")
    parser.add_argument("--url", default="https://classmanager.site", help="서버 URL")
    parser.add_argument("--token", default="", help="JWT 토큰 (localStorage에서 복사)")
    parser.add_argument("--academy", default="", help="학원 ID")
    parser.add_argument("--test", action="store_true", help="카드 UID만 읽기 (서버 호출 없음)")
    args = parser.parse_args()

    run(args.url, args.token, args.academy, args.test)
