# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for ClassManager NFC 키오스크

import os
block_cipher = None

# OneDrive 밖에 빌드 (OneDrive 동기화 충돌 방지)
_BUILD_DIR = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "classmanager_kiosk_build")
_DIST_DIR  = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "classmanager_kiosk_dist")

a = Analysis(
    ['server.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ClassManager_Kiosk',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
