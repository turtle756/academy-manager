import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter()


def _find_installer() -> Path | None:
    """인스톨러 EXE 위치 탐색"""
    candidates = [
        Path(__file__).parent.parent / "static" / "ClassManager_Kiosk_Setup.exe",
        Path("/app/app/static/ClassManager_Kiosk_Setup.exe"),
        Path(__file__).parent.parent.parent.parent / "nfc-relay" / "dist" / "ClassManager_Kiosk_Setup.exe",
        Path(__file__).parent.parent.parent / "nfc-relay" / "dist" / "ClassManager_Kiosk_Setup.exe",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def _find_nfc_relay_dir() -> Path | None:
    """nfc-relay 폴더 위치 탐색 (ZIP fallback용)"""
    candidates = [
        Path(__file__).parent.parent.parent.parent / "nfc-relay",
        Path(__file__).parent.parent.parent / "nfc-relay",
        Path("/app/nfc-relay"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


@router.get("/download")
async def download_kiosk():
    """NFC 키오스크 인스톨러 다운로드.
    인스톨러 EXE가 있으면 EXE를, 없으면 ZIP으로 fallback.
    """
    # 인스톨러 EXE 우선
    installer = _find_installer()
    if installer:
        return FileResponse(
            path=str(installer),
            media_type="application/octet-stream",
            filename="ClassManager_Kiosk_Setup.exe",
        )

    nfc_dir = _find_nfc_relay_dir()

    # fallback: ZIP (인스톨러 빌드 전 or 개발 환경)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if nfc_dir:
            for file in ["server.py", "relay.py", "키오스크_실행.bat"]:
                path = nfc_dir / file
                if path.exists():
                    zf.write(path, arcname=file)

        readme = """ClassManager NFC 키오스크
========================

[권장] 인스톨러 버전을 사용하세요.
관리자 페이지 설정 탭에서 최신 인스톨러를 다운로드할 수 있습니다.

이 ZIP은 개발/임시용입니다.

실행 전 준비:
1. Python 3.8+ 설치 (https://www.python.org/downloads/)
   - 설치 시 "Add Python to PATH" 반드시 체크
2. USB NFC 리더기 (ACR1252U) PC에 연결

실행:
1. "키오스크_실행.bat" 우클릭 → 속성 → 차단 해제 체크 → 확인
2. "키오스크_실행.bat" 더블클릭
3. 브라우저가 자동으로 열립니다 (http://localhost:8888)
4. 우측 상단 구석을 3초 길게 누르면 관리자 모드 (기본 PIN: 0000)
5. 설정 탭에서 토큰·학원 ID 입력 후 저장
"""
        zf.writestr("README.txt", readme)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=classmanager-kiosk.zip"},
    )
