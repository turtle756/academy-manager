[Setup]
AppName=ClassManager NFC 키오스크
AppVersion=1.0
AppPublisher=ClassManager
DefaultDirName={autopf}\ClassManager Kiosk
DefaultGroupName=ClassManager Kiosk
OutputDir=dist
OutputBaseFilename=ClassManager_Kiosk_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; 한글 설정
; 설치 화면 언어
ShowLanguageDialog=no

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "추가 작업:"

[Files]
Source: "dist\ClassManager_Kiosk.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\ClassManager NFC 키오스크"; Filename: "{app}\ClassManager_Kiosk.exe"
Name: "{group}\제거"; Filename: "{uninstallexe}"
Name: "{commondesktop}\ClassManager NFC 키오스크"; Filename: "{app}\ClassManager_Kiosk.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\ClassManager_Kiosk.exe"; Description: "키오스크 서버 시작"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
