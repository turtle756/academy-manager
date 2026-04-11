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
<title>ClassManager NFC 키오스크</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; min-height: 100vh; }
.header { background: #1e293b; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
.header h1 { font-size: 22px; }
.header .clock { font-family: monospace; color: #94a3b8; font-size: 18px; }
.tabs { background: #1e293b; padding: 0 24px 16px; display: flex; gap: 8px; }
.tab { flex: 1; padding: 14px; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; background: #334155; color: #94a3b8; transition: all .2s; }
.tab.active { background: #2563eb; color: #fff; }
.main { padding: 24px; max-width: 900px; margin: 0 auto; }

/* 설정 */
.settings-card { background: #1e293b; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
.settings-card h3 { margin-bottom: 16px; font-size: 18px; }
.settings-card input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #fff; margin-bottom: 12px; font-size: 14px; }
.settings-card button { padding: 12px 24px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
.settings-card button:hover { background: #1d4ed8; }

/* 출석 모드 */
.checkin-view { text-align: center; padding: 60px 24px; }
.checkin-icon { width: 200px; height: 200px; border-radius: 50%; background: rgba(37,99,235,.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 32px; font-size: 80px; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: .8; } }
.checkin-view h2 { font-size: 32px; margin-bottom: 12px; }
.checkin-view p { color: #94a3b8; font-size: 16px; }

/* 결과 */
.result-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 100; font-size: 24px; text-align: center; }
.result-overlay .big { font-size: 100px; margin-bottom: 24px; }
.result-overlay h2 { font-size: 48px; margin-bottom: 16px; }
.result-overlay p { font-size: 28px; color: #e2e8f0; }
.result-success { background: rgba(5, 150, 105, .95); }
.result-error { background: rgba(220, 38, 38, .95); }
.result-warning { background: rgba(217, 119, 6, .95); }

/* 등록 모드 */
.register-view { padding: 20px 0; }
.register-status { background: #1e293b; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px; font-size: 15px; color: #cbd5e1; }
.student-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.student-card { background: #1e293b; padding: 16px 20px; border-radius: 12px; cursor: pointer; border: 2px solid transparent; transition: all .15s; }
.student-card:hover { border-color: #3b82f6; background: #263449; }
.student-card.registered { border-color: #10b981; }
.student-card.selected { border-color: #f59e0b; background: #1e3a5f; }
.student-card .name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.student-card .status { font-size: 12px; color: #94a3b8; }
.student-card .status.reg { color: #10b981; }
.student-card .uid { font-family: monospace; font-size: 11px; color: #64748b; margin-top: 4px; word-break: break-all; }
.student-card button { margin-top: 8px; padding: 6px 12px; border: none; border-radius: 6px; background: #dc2626; color: #fff; font-size: 12px; cursor: pointer; }
</style>
</head>
<body>
<div class="header">
  <h1>🎫 NFC 키오스크</h1>
  <span class="clock" id="clock">00:00:00</span>
</div>

<div class="tabs">
  <button class="tab active" data-mode="checkin">출석 체크</button>
  <button class="tab" data-mode="register">카드 등록</button>
  <button class="tab" data-mode="settings">설정</button>
</div>

<div class="main">
  <!-- 출석 체크 -->
  <div id="view-checkin" class="checkin-view">
    <div class="checkin-icon">📱</div>
    <h2>NFC 카드를 터치하세요</h2>
    <p>리더기에 카드를 가까이 대면 자동으로 출석 처리됩니다</p>
  </div>

  <!-- 등록 모드 -->
  <div id="view-register" class="register-view" style="display:none">
    <div class="register-status" id="register-status">학생을 선택한 후 카드를 터치하세요</div>
    <div class="student-list" id="student-list"></div>
  </div>

  <!-- 설정 -->
  <div id="view-settings" style="display:none">
    <div class="settings-card">
      <h3>서버 연결</h3>
      <input id="api-url" placeholder="서버 URL" value="https://classmanager.site">
      <input id="token" placeholder="JWT 토큰 (웹 로그인 후 localStorage에서 복사)">
      <input id="academy-id" placeholder="학원 ID" type="number">
      <button onclick="saveSettings()">저장</button>
    </div>
  </div>
</div>

<div id="result" class="result-overlay" style="display:none"></div>

<script>
let mode = 'checkin';
let selectedStudent = null;
let students = [];
let lastUid = null;

// Settings
function loadSettings() {
  document.getElementById('api-url').value = localStorage.getItem('apiUrl') || 'https://classmanager.site';
  document.getElementById('token').value = localStorage.getItem('token') || '';
  document.getElementById('academy-id').value = localStorage.getItem('academyId') || '';
}
function saveSettings() {
  localStorage.setItem('apiUrl', document.getElementById('api-url').value.trim());
  localStorage.setItem('token', document.getElementById('token').value.trim());
  localStorage.setItem('academyId', document.getElementById('academy-id').value.trim());
  alert('저장됨');
  if (mode === 'register') loadStudents();
}
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

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    mode = tab.dataset.mode;
    document.getElementById('view-checkin').style.display = mode === 'checkin' ? 'block' : 'none';
    document.getElementById('view-register').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('view-settings').style.display = mode === 'settings' ? 'block' : 'none';
    if (mode === 'register') loadStudents();
  };
});

// Clock
setInterval(() => {
  const d = new Date();
  document.getElementById('clock').textContent = d.toLocaleTimeString('ko-KR');
}, 1000);

// Load students
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
      ${s.nfc_uid ? `<button onclick="event.stopPropagation(); unregister(${s.id})">등록 해제</button>` : ''}
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

// Show result
function showResult(type, icon, title, subtitle) {
  const el = document.getElementById('result');
  el.className = 'result-overlay result-' + type;
  el.innerHTML = `<div><div class="big">${icon}</div><h2>${title}</h2><p>${subtitle}</p></div>`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// Handle NFC scan
async function handleNfcScan(uid) {
  if (uid === lastUid) return;
  lastUid = uid;
  setTimeout(() => { if (lastUid === uid) lastUid = null; }, 3000);

  if (mode === 'checkin') {
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
  } else if (mode === 'register') {
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
    } catch (e) {
      updateStatus(`❌ ${e.message}`);
    }
  }
}

// Poll NFC events
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
