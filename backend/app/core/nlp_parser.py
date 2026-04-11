"""
자연어 파서 — 규칙 기반 (GPU/LLM 불필요)
rapidfuzz: 이름 오타 허용 매칭
"""
import re
from datetime import date, timedelta
from typing import Any

try:
    from rapidfuzz import process, fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False


# ── 날짜 파싱 ─────────────────────────────────────────────

def parse_date(text: str) -> date | None:
    today = date.today()

    if re.search(r"오늘|today", text):
        return today
    if re.search(r"어제|yesterday", text):
        return today - timedelta(days=1)
    if re.search(r"그제|재작일", text):
        return today - timedelta(days=2)
    if re.search(r"내일|tomorrow", text):
        return today + timedelta(days=1)
    if re.search(r"모레", text):
        return today + timedelta(days=2)

    # "다음주 월요일" 등
    next_day_map = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}
    m = re.search(r"다음\s*주?\s*([월화수목금토일])요?일?", text)
    if m:
        target_wd = next_day_map[m.group(1)]
        days_ahead = (target_wd - today.weekday() + 7) % 7
        days_ahead = days_ahead if days_ahead > 0 else 7
        return today + timedelta(days=days_ahead)

    # "이번주 금요일"
    m = re.search(r"이번\s*주?\s*([월화수목금토일])요?일?", text)
    if m:
        target_wd = next_day_map[m.group(1)]
        days_ahead = (target_wd - today.weekday()) % 7
        return today + timedelta(days=days_ahead)

    # "MM월 DD일"
    m = re.search(r"(\d{1,2})월\s*(\d{1,2})일", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        try:
            d = date(today.year, month, day)
            if d < today - timedelta(days=180):
                d = date(today.year + 1, month, day)
            return d
        except ValueError:
            pass

    return None


def parse_month(text: str) -> tuple[int, int] | None:
    """(year, month) 반환"""
    today = date.today()
    if re.search(r"이번\s*달?|이번\s*월|현재\s*달?", text):
        return (today.year, today.month)
    if re.search(r"지난\s*달?|저번\s*달?|전\s*달?", text):
        d = today.replace(day=1) - timedelta(days=1)
        return (d.year, d.month)
    if re.search(r"다음\s*달?", text):
        if today.month == 12:
            return (today.year + 1, 1)
        return (today.year, today.month + 1)
    m = re.search(r"(\d{1,2})월", text)
    if m:
        return (today.year, int(m.group(1)))
    return None


# ── 이름 매칭 ─────────────────────────────────────────────

def match_name(text: str, candidates: list[str], threshold: int = 75) -> str | None:
    """후보 이름 목록에서 텍스트와 가장 유사한 이름 반환"""
    if not candidates:
        return None
    if HAS_RAPIDFUZZ:
        result = process.extractOne(text, candidates, scorer=fuzz.partial_ratio)
        if result and result[1] >= threshold:
            return result[0]
    else:
        # rapidfuzz 없으면 단순 포함 여부
        for c in candidates:
            if c in text or text in c:
                return c
    return None


def extract_name_from_text(text: str, candidates: list[str]) -> str | None:
    """텍스트에서 후보 이름 중 하나를 찾아 반환"""
    # 정확히 포함된 이름 먼저
    for name in sorted(candidates, key=len, reverse=True):
        if name in text:
            return name
    # rapidfuzz 유사도 매칭
    if HAS_RAPIDFUZZ:
        # 2글자 이상 단어 추출
        words = re.findall(r"[가-힣]{2,4}", text)
        for word in words:
            result = process.extractOne(word, candidates, scorer=fuzz.ratio)
            if result and result[1] >= 80:
                return result[0]
    return None


# ── 의도 분류 ─────────────────────────────────────────────

ATTENDANCE_STATUS_MAP = {
    "출석": "present",
    "등원": "present",
    "왔어": "present",
    "결석": "absent",
    "안왔": "absent",
    "안 왔": "absent",
    "지각": "late",
    "조퇴": "early_leave",
    "일찍 갔": "early_leave",
}

INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    # 학생 추가
    ("student_create",   ["추가해줘", "추가 해줘", "등록해줘", "등록 해줘",
                          "새로 추가", "원생 추가", "학생 추가", "학생 등록"]),
    # 출결 처리
    ("attendance_set",   ["결석 처리", "출석 처리", "지각 처리", "조퇴 처리",
                          "결석으로", "출석으로", "결석했", "출석했"]),
    # 출결 조회
    ("attendance_query", ["출석 현황", "결석자", "결석한 학생", "출석률",
                          "오늘 출석", "출결 확인", "누가 결석", "안 온 학생"]),
    # 납부 완료 처리
    ("payment_set",      ["납부 완료", "납부했", "수납 완료", "냈어", "냈습니다",
                          "돈 받았", "수납했"]),
    # 미납 조회
    ("payment_query",    ["미납", "납부 안", "안 낸", "미납자", "납부 현황",
                          "납부율", "수납 현황"]),
    # 상담 예약
    ("counseling_create",["상담 예약", "상담 잡아", "상담 일정", "상담 등록"]),
    # 상담 조회
    ("counseling_query", ["상담 일정", "상담 목록", "상담 현황", "예정된 상담"]),
    # 학생 조회
    ("student_query",    ["학생 정보", "연락처", "학부모", "학생 조회", "누구야",
                          "몇 명", "재원생", "학생 수"]),
]

def detect_intent(text: str) -> str | None:
    for intent, keywords in INTENT_PATTERNS:
        for kw in keywords:
            if kw in text:
                return intent

    # 단어 단위 추가 감지
    if re.search(r"추가|등록", text) and re.search(r"해줘|해주세요|할게|하자", text):
        return "student_create"
    if re.search(r"결석|지각|조퇴|출석", text) and re.search(r"처리|했|해줘|해주세요", text):
        return "attendance_set"
    if re.search(r"결석|지각|조퇴|출석", text):
        return "attendance_query"
    if re.search(r"납부|수납|월비|수강료", text) and re.search(r"완료|했|해줘|받았", text):
        return "payment_set"
    if re.search(r"납부|수납|미납", text):
        return "payment_query"
    if re.search(r"상담", text):
        return "counseling_query"

    return None


def detect_attendance_status(text: str) -> str:
    for keyword, status in ATTENDANCE_STATUS_MAP.items():
        if keyword in text:
            return status
    return "present"


# ── 메인 파서 ─────────────────────────────────────────────

class ParseResult:
    def __init__(self, intent: str, params: dict[str, Any], confidence: str = "high"):
        self.intent = intent
        self.params = params
        self.confidence = confidence  # high / low

    def to_dict(self):
        return {"intent": self.intent, "params": self.params, "confidence": self.confidence}


def extract_new_name(text: str) -> str | None:
    """기존 학생 목록 없이 텍스트에서 이름 후보 추출 (2~4 한글 글자, 동사 키워드 제외)"""
    STOP_WORDS = {"추가", "등록", "처리", "학생", "원생", "오늘", "내일", "어제", "이번", "지난", "출석", "결석"}
    words = re.findall(r"[가-힣]{2,4}", text)
    for w in words:
        if w not in STOP_WORDS:
            return w
    return None


def parse(text: str, student_names: list[str], classroom_names: list[str]) -> ParseResult | None:
    text = text.strip()
    intent = detect_intent(text)

    if not intent:
        return None

    params: dict[str, Any] = {}

    # 학생 이름 추출
    student_name = extract_name_from_text(text, student_names)
    # student_create: 기존 목록에 없어도 이름 추출 시도
    if not student_name and intent == "student_create":
        student_name = extract_new_name(text)
    if student_name:
        params["student_name"] = student_name

    # 반 이름 추출
    classroom_name = extract_name_from_text(text, classroom_names)
    if classroom_name:
        params["classroom_name"] = classroom_name

    # 날짜 추출
    target_date = parse_date(text)
    if target_date:
        params["date"] = target_date.isoformat()
    elif intent in ("attendance_set", "attendance_query"):
        params["date"] = date.today().isoformat()

    # 월 추출
    month_info = parse_month(text)
    if month_info:
        params["year"], params["month"] = month_info

    # 출결 상태
    if intent == "attendance_set":
        params["status"] = detect_attendance_status(text)

    # 신뢰도: 학생 이름이 필요한 액션에서 이름이 없으면 low
    confidence = "high"
    if intent in ("attendance_set", "payment_set", "student_create") and "student_name" not in params:
        confidence = "low"

    return ParseResult(intent=intent, params=params, confidence=confidence)
