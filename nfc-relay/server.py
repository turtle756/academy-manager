"""
NFC 리더 로컬 웹 서버
PC에 USB NFC 리더기를 꽂고 이 서버를 실행하면, 브라우저에서 접근 가능한 UI를 제공한다.

사용법:
  python server.py

그 후 브라우저에서:
  http://localhost:8888

같은 네트워크의 태블릿/노트북에서도 접속 가능:
  http://<PC_IP>:8888
"""

import sys
import json
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from queue import Queue, Empty

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import ctypes
from relay import establish_context, list_readers, connect_card, get_uid, SCARD_S_SUCCESS, SCARD_LEAVE_CARD

winscard = ctypes.windll.LoadLibrary("WinSCard.dll")

PORT = 8888
nfc_queue: Queue = Queue()
last_uid_info = {"uid": None, "timestamp": 0}


def nfc_reader_thread():
    """백그라운드에서 NFC 카드 계속 읽기"""
    try:
        ctx = establish_context()
    except Exception as e:
        print(f"❌ PC/SC 초기화 실패: {e}")
        return

    reader = None
    while not reader:
        readers = list_readers(ctx)
        for r in readers:
            if "PICC" in r:
                reader = r
                break
        if not reader:
            print("리더기 대기 중... (5초 후 재시도)")
            time.sleep(5)

    print(f"✓ 리더기 감지: {reader}")

    last_uid = None
    last_time = 0.0

    while True:
        try:
            card, protocol, rv = connect_card(ctx, reader)
            if rv == SCARD_S_SUCCESS:
                uid = get_uid(card, protocol)
                winscard.SCardDisconnect(card, SCARD_LEAVE_CARD)
                if uid:
                    now = time.time()
                    if uid != last_uid or now - last_time > 2:
                        last_uid = uid
                        last_time = now
                        nfc_queue.put(uid)
                        last_uid_info["uid"] = uid
                        last_uid_info["timestamp"] = now
                        print(f"[카드] {uid}")
            time.sleep(0.2)
        except Exception as e:
            print(f"카드 읽기 오류: {e}")
            time.sleep(1)


HTML_PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>출석 체크</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
html, body { height: 100%; overflow: hidden; }
body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; }

/* 학생용 전체화면 출석 */
.kiosk-screen { position: fixed; inset: 0; display: flex; flex-direction: column; }
.kiosk-header { padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
.kiosk-title { font-size: 24px; font-weight: 600; color: #cbd5e1; }
.clock { font-family: monospace; color: #64748b; font-size: 20px; }

/* 우측 상단 숨겨진 관리자 진입 영역 */
.secret-zone { position: fixed; top: 0; right: 0; width: 120px; height: 120px; z-index: 10; cursor: default; }

.kiosk-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px; }
.kiosk-icon { width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle, rgba(37,99,235,.3) 0%, rgba(37,99,235,.05) 70%); display: flex; align-items: center; justify-content: center; margin-bottom: 48px; font-size: 110px; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.kiosk-main h2 { font-size: 48px; font-weight: 700; margin-bottom: 16px; }
.kiosk-main p { font-size: 22px; color: #94a3b8; }
.kiosk-footer { padding: 24px; text-align: center; color: #475569; font-size: 13px; }

/* 결과 오버레이 */
.result-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 100; text-align: center; animation: fadeIn .2s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.result-overlay .big { font-size: 140px; margin-bottom: 32px; }
.result-overlay h2 { font-size: 64px; margin-bottom: 24px; font-weight: 700; }
.result-overlay p { font-size: 36px; color: #e2e8f0; }
.result-success { background: rgba(5, 150, 105, .97); }
.result-error { background: rgba(220, 38, 38, .97); }
.result-warning { background: rgba(217, 119, 6, .97); }

/* 관리자 모달 */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.8); z-index: 200; display: none; align-items: center; justify-content: center; padding: 20px; }
.modal-backdrop.show { display: flex; }
.modal { background: #1e293b; border-radius: 20px; max-width: 900px; width: 100%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
.modal-header { padding: 20px 24px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-size: 20px; }
.close-btn { background: #334155; border: none; color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
.modal-body { padding: 24px; overflow-y: auto; flex: 1; }

/* PIN 입력 */
.pin-display { display: flex; gap: 12px; justify-content: center; margin: 24px 0; }
.pin-digit { width: 52px; height: 64px; border-radius: 10px; border: 2px solid #334155; background: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; }
.pin-digit.filled { border-color: #3b82f6; }
.numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 280px; margin: 0 auto; }
.numpad button { height: 64px; border-radius: 12px; border: none; background: #334155; color: #fff; font-size: 22px; font-weight: 600; cursor: pointer; }
.numpad button:hover { background: #475569; }
.pin-error { color: #ef4444; text-align: center; margin-top: 12px; }

/* 관리자 탭 */
.admin-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.admin-tab { flex: 1; padding: 12px; border: none; border-radius: 10px; background: #334155; color: #94a3b8; font-weight: 600; cursor: pointer; }
.admin-tab.active { background: #2563eb; color: #fff; }

.settings-form input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #fff; margin-bottom: 12px; font-size: 14px; }
.settings-form button { padding: 12px 24px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
.settings-form label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 4px; }

.register-status { background: #0f172a; padding: 14px 18px; border-radius: 10px; margin-bottom: 14px; font-size: 14px; color: #cbd5e1; }
.student-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.student-card { background: #0f172a; padding: 14px 16px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; transition: all .15s; }
.student-card:hover { border-color: #3b82f6; }
.student-card.registered { border-color: #10b981; }
.student-card.selected { border-color: #f59e0b; background: #1e3a5f; }
.student-card .name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.student-card .status { font-size: 11px; color: #94a3b8; }
.student-card .status.reg { color: #10b981; }
.student-card .uid { font-family: monospace; font-size: 10px; color: #64748b; margin-top: 4px; word-break: break-all; }
.student-card .unreg-btn { margin-top: 6px; padding: 4px 10px; border: none; border-radius: 6px; background: #dc2626; color: #fff; font-size: 11px; cursor: pointer; }

.long-press-hint { position: fixed; bottom: 16px; right: 16px; width: 10px; height: 10px; border-radius: 50%; background: rgba(100,116,139,.2); }
</style>
</head>
<body>

<!-- 학생용 풀스크린 출석 화면 -->
<div class="kiosk-screen">
  <div class="kiosk-header">
    <div class="kiosk-title">출석 체크</div>
    <div class="clock" id="clock">00:00:00</div>
  </div>
  <div class="kiosk-main">
    <div class="kiosk-icon">📱</div>
    <h2>NFC 카드를 터치하세요</h2>
    <p>리더기에 카드를 가까이 대면 자동으로 출석 처리됩니다</p>
  </div>
  <div class="kiosk-footer">ClassManager · 학원 관리 시스템</div>
</div>

<!-- 숨겨진 관리자 진입 영역 (우측 상단 5초 길게 누르기) -->
<div class="secret-zone" id="secret-zone"></div>
<div class="long-press-hint"></div>

<!-- 결과 오버레이 -->
<div id="result" class="result-overlay" style="display:none"></div>

<!-- PIN 입력 모달 -->
<div class="modal-backdrop" id="pin-modal">
  <div class="modal" style="max-width:400px">
    <div class="modal-header">
      <h3>관리자 PIN 입력</h3>
      <button class="close-btn" onclick="closePinModal()">닫기</button>
    </div>
    <div class="modal-body">
      <div class="pin-display">
        <div class="pin-digit" id="pd0"></div>
        <div class="pin-digit" id="pd1"></div>
        <div class="pin-digit" id="pd2"></div>
        <div class="pin-digit" id="pd3"></div>
      </div>
      <div class="numpad">
        <button onclick="pinDigit('1')">1</button>
        <button onclick="pinDigit('2')">2</button>
        <button onclick="pinDigit('3')">3</button>
        <button onclick="pinDigit('4')">4</button>
        <button onclick="pinDigit('5')">5</button>
        <button onclick="pinDigit('6')">6</button>
        <button onclick="pinDigit('7')">7</button>
        <button onclick="pinDigit('8')">8</button>
        <button onclick="pinDigit('9')">9</button>
        <button onclick="pinDel()">←</button>
        <button onclick="pinDigit('0')">0</button>
        <button onclick="pinSubmit()" style="background:#2563eb">✓</button>
      </div>
      <div class="pin-error" id="pin-error"></div>
    </div>
  </div>
</div>

<!-- 관리자 모달 -->
<div class="modal-backdrop" id="admin-modal">
  <div class="modal">
    <div class="modal-header">
      <h3>관리자 모드</h3>
      <button class="close-btn" onclick="closeAdminModal()">닫기</button>
    </div>
    <div class="modal-body">
      <div class="admin-tabs">
        <button class="admin-tab active" data-admin-tab="register">카드 등록</button>
        <button class="admin-tab" data-admin-tab="settings">설정</button>
      </div>

      <!-- 카드 등록 -->
      <div id="admin-register">
        <div class="register-status" id="register-status">학생을 선택한 후 카드를 터치하세요</div>
        <div class="student-list" id="student-list"></div>
      </div>

      <!-- 설정 -->
      <div id="admin-settings" style="display:none">
        <div class="settings-form">
          <label>서버 URL</label>
          <input id="api-url" placeholder="https://classmanager.site">
          <label>JWT 토큰</label>
          <input id="token" placeholder="웹 로그인 후 Console에서 복사">
          <label>학원 ID</label>
          <input id="academy-id" placeholder="예: 1" type="number">
          <label>관리자 PIN</label>
          <input id="admin-pin" placeholder="기본값: 0000" type="password">
          <button onclick="saveSettings()">저장</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const DEFAULT_PIN = '0000';
let adminMode = false;           // 관리자 모달 열려 있는가
let currentAdminTab = 'register';
let selectedStudent = null;
let students = [];
let lastUid = null;
let pinInput = '';

// ===== Settings =====
function loadSettings() {
  document.getElementById('api-url').value = localStorage.getItem('apiUrl') || 'https://classmanager.site';
  document.getElementById('token').value = localStorage.getItem('token') || '';
  document.getElementById('academy-id').value = localStorage.getItem('academyId') || '';
  document.getElementById('admin-pin').value = localStorage.getItem('adminPin') || '';
}
function saveSettings() {
  localStorage.setItem('apiUrl', document.getElementById('api-url').value.trim());
  localStorage.setItem('token', document.getElementById('token').value.trim());
  localStorage.setItem('academyId', document.getElementById('academy-id').value.trim());
  const pin = document.getElementById('admin-pin').value.trim();
  if (pin) localStorage.setItem('adminPin', pin);
  alert('저장됨');
}
function getAdminPin() { return localStorage.getItem('adminPin') || DEFAULT_PIN; }
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'X-Academy-Id': localStorage.getItem('academyId'),
  };
}
function apiUrl(path) {
  return (localStorage.getItem('apiUrl') || 'https://classmanager.site') + path;
}

// ===== Clock =====
setInterval(() => {
  const d = new Date();
  document.getElementById('clock').textContent = d.toLocaleTimeString('ko-KR');
}, 1000);

// ===== 숨겨진 관리자 진입 (5초 길게 누르기) =====
let pressTimer = null;
const secretZone = document.getElementById('secret-zone');
function startPress(e) {
  e.preventDefault();
  pressTimer = setTimeout(() => {
    openPinModal();
  }, 3000); // 3초 길게 누르기
}
function cancelPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
}
secretZone.addEventListener('mousedown', startPress);
secretZone.addEventListener('mouseup', cancelPress);
secretZone.addEventListener('mouseleave', cancelPress);
secretZone.addEventListener('touchstart', startPress, { passive: false });
secretZone.addEventListener('touchend', cancelPress);
secretZone.addEventListener('touchcancel', cancelPress);

// ===== PIN 모달 =====
function openPinModal() {
  pinInput = '';
  updatePinDisplay();
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-modal').classList.add('show');
}
function closePinModal() {
  document.getElementById('pin-modal').classList.remove('show');
  pinInput = '';
}
function pinDigit(d) {
  if (pinInput.length < 4) { pinInput += d; updatePinDisplay(); }
  if (pinInput.length === 4) setTimeout(pinSubmit, 200);
}
function pinDel() { pinInput = pinInput.slice(0, -1); updatePinDisplay(); }
function updatePinDisplay() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pd' + i);
    if (pinInput[i]) { el.textContent = '●'; el.classList.add('filled'); }
    else { el.textContent = ''; el.classList.remove('filled'); }
  }
}
function pinSubmit() {
  if (pinInput === getAdminPin()) {
    closePinModal();
    openAdminModal();
  } else {
    document.getElementById('pin-error').textContent = 'PIN이 일치하지 않습니다';
    pinInput = '';
    updatePinDisplay();
  }
}

// ===== 관리자 모달 =====
function openAdminModal() {
  adminMode = true;
  document.getElementById('admin-modal').classList.add('show');
  loadSettings();
  loadStudents();
}
function closeAdminModal() {
  adminMode = false;
  selectedStudent = null;
  document.getElementById('admin-modal').classList.remove('show');
}
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentAdminTab = tab.dataset.adminTab;
    document.getElementById('admin-register').style.display = currentAdminTab === 'register' ? 'block' : 'none';
    document.getElementById('admin-settings').style.display = currentAdminTab === 'settings' ? 'block' : 'none';
    if (currentAdminTab === 'register') loadStudents();
  };
});

// ===== 학생 목록 =====
async function loadStudents() {
  try {
    const res = await fetch(apiUrl('/api/students'), { headers: getHeaders() });
    if (!res.ok) {
      document.getElementById('register-status').textContent = '⚠️ 로그인이 필요합니다. 설정 탭에서 토큰을 입력하세요.';
      return;
    }
    students = await res.json();
    renderStudents();
  } catch (e) {
    document.getElementById('register-status').textContent = '❌ 서버 연결 실패: ' + e.message;
  }
}
function renderStudents() {
  const list = document.getElementById('student-list');
  list.innerHTML = '';
  students.forEach(s => {
    const card = document.createElement('div');
    card.className = 'student-card';
    if (s.nfc_uid) card.classList.add('registered');
    if (selectedStudent?.id === s.id) card.classList.add('selected');
    card.innerHTML = `
      <div class="name">${s.name}</div>
      <div class="status ${s.nfc_uid ? 'reg' : ''}">${s.nfc_uid ? '🟢 등록됨' : '⚪ 미등록'} · PIN: ${s.pin_code}</div>
      ${s.nfc_uid ? `<div class="uid">${s.nfc_uid}</div>` : ''}
      ${s.nfc_uid ? `<button class="unreg-btn" onclick="event.stopPropagation(); unregister(${s.id})">등록 해제</button>` : ''}
    `;
    card.onclick = () => { selectedStudent = s; renderStudents(); updateStatus(`🟢 ${s.name} 선택됨 — NFC 카드를 터치하세요`); };
    list.appendChild(card);
  });
}
function updateStatus(msg) { document.getElementById('register-status').textContent = msg; }
async function unregister(studentId) {
  if (!confirm('등록 해제하시겠습니까?')) return;
  await fetch(apiUrl(`/api/students/${studentId}/unregister-nfc`), { method: 'POST', headers: getHeaders() });
  loadStudents();
}

// ===== 결과 표시 =====
function showResult(type, icon, title, subtitle) {
  const el = document.getElementById('result');
  el.className = 'result-overlay result-' + type;
  el.innerHTML = `<div><div class="big">${icon}</div><h2>${title}</h2><p>${subtitle}</p></div>`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ===== NFC 스캔 처리 =====
async function handleNfcScan(uid) {
  if (uid === lastUid) return;
  lastUid = uid;
  setTimeout(() => { if (lastUid === uid) lastUid = null; }, 3000);

  // 관리자 모드 + 등록 탭 열려 있으면 카드 등록
  if (adminMode && currentAdminTab === 'register') {
    if (!selectedStudent) { updateStatus('먼저 학생을 선택하세요'); return; }
    try {
      const res = await fetch(apiUrl(`/api/students/${selectedStudent.id}/register-nfc?nfc_uid=${uid}`), {
        method: 'POST', headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        updateStatus(`✅ ${selectedStudent.name} 등록 완료! (UID: ${uid})`);
        selectedStudent = null;
        loadStudents();
      } else {
        updateStatus(`❌ ${data.detail || '등록 실패'}`);
      }
    } catch (e) { updateStatus(`❌ ${e.message}`); }
    return;
  }

  // 기본: 출석 체크
  try {
    const res = await fetch(apiUrl('/api/attendance/check-in/nfc'), {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ nfc_uid: uid })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (data.status === 'already_checked') showResult('warning', '⚠️', '이미 출석됨', data.student_name + ' 학생');
      else showResult('success', '✅', '출석 완료!', data.student_name + ' 학생');
    } else {
      showResult('error', '❌', '실패', data.detail || '알 수 없는 오류');
    }
  } catch (e) {
    showResult('error', '❌', '오류', e.message);
  }
}

// ===== NFC 폴링 =====
async function pollNfc() {
  try {
    const res = await fetch('/nfc/poll');
    const data = await res.json();
    if (data.uid) handleNfcScan(data.uid);
  } catch (e) {}
}
setInterval(pollNfc, 300);

loadSettings();
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # 조용히

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        elif self.path == "/nfc/poll":
            try:
                uid = nfc_queue.get_nowait()
                self._json(200, {"uid": uid})
            except Empty:
                self._json(200, {"uid": None})
        else:
            self.send_response(404)
            self.end_headers()


def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    # Start NFC thread
    thread = threading.Thread(target=nfc_reader_thread, daemon=True)
    thread.start()

    # Start HTTP server
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    local_ip = get_local_ip()
    print("=" * 60)
    print("  ClassManager NFC 키오스크 서버")
    print("=" * 60)
    print(f"  PC에서 접속:     http://localhost:{PORT}")
    print(f"  네트워크 접속:    http://{local_ip}:{PORT}")
    print("=" * 60)
    print("  종료: Ctrl+C")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")


if __name__ == "__main__":
    main()
