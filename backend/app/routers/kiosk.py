import io
import zipfile
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()


def _find_nfc_relay_dir() -> Path | None:
    """nfc-relay 폴더 위치 탐색 (Docker / 로컬 모두)"""
    candidates = [
        Path(__file__).parent.parent.parent.parent / "nfc-relay",  # /app/nfc-relay
        Path(__file__).parent.parent.parent / "nfc-relay",
        Path("/app/nfc-relay"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


@router.get("/download")
async def download_kiosk_zip():
    """NFC 키오스크 프로그램 ZIP 다운로드"""
    nfc_dir = _find_nfc_relay_dir()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if nfc_dir:
            for file in ["server.py", "relay.py", "키오스크_실행.bat"]:
                path = nfc_dir / file
                if path.exists():
                    zf.write(path, arcname=file)

        # README 추가
        readme = """ClassManager NFC 키오스크
========================

설치:
1. Python 3.8+ 설치 (https://www.python.org/downloads/)
2. USB NFC 리더기 (ACR1252U) PC에 연결

실행:
1. 이 폴더의 "키오스크_실행.bat" 더블클릭
2. 브라우저가 자동으로 열립니다 (http://localhost:8888)
3. 우측 상단 구석을 3초 길게 누르면 관리자 모드 진입 (기본 PIN: 0000)
4. 설정 탭에서 토큰과 학원 ID 입력 후 저장
5. 카드 등록 탭에서 학생별로 NFC 카드 등록

사용:
- 학생: 리더기에 카드 터치만 하면 자동 출석
- 관리자: 우측 상단 3초 길게 누르기 → PIN 입력 → 관리자 모드

네트워크 접속:
- 같은 WiFi의 태블릿/노트북에서도 접속 가능
- 서버 실행 시 표시되는 네트워크 주소 사용 (예: http://192.168.0.5:8888)

문제 발생 시:
- 리더기가 인식 안 되면 USB 다시 꽂기
- Python이 없다는 오류면 python.org에서 설치 후 "Add to PATH" 체크
"""
        zf.writestr("README.txt", readme)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=classmanager-kiosk.zip"},
    )
