"""
자연어 파서 — kiwipiepy 형태소 분석 + TF-IDF 의도 분류 + rapidfuzz 엔티티 추출
GPU/LLM 불필요, $0 운영비용
"""
import re
from datetime import date, timedelta
from typing import Any

# ── 선택적 라이브러리 ───────────────────────────────────────

try:
    from rapidfuzz import process, fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False

try:
    from kiwipiepy import Kiwi
    _kiwi_instance: Kiwi | None = None

    def _get_kiwi() -> Kiwi | None:
        global _kiwi_instance
        if _kiwi_instance is None:
            try:
                _kiwi_instance = Kiwi()
            except Exception:
                pass
        return _kiwi_instance

    HAS_KIWI = True
except ImportError:
    HAS_KIWI = False
    def _get_kiwi():
        return None

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


# ── 형태소 전처리 ──────────────────────────────────────────

# kiwipiepy가 명사로 잘못 잡을 수 있는 동사/조사 필터
_MORPH_KEEP_TAGS = {'NNG', 'NNP', 'NNB', 'VV', 'VA', 'XR', 'MAG'}

def morpheme_tokenize(text: str) -> str:
    """형태소 분석 후 의미 있는 어근만 추출해 공백으로 join.
    kiwipiepy 없으면 원문 반환."""
    kiwi = _get_kiwi()
    if kiwi is None:
        return text
    try:
        result = kiwi.analyze(text)[0][0]
        tokens = [t.form for t in result if t.tag in _MORPH_KEEP_TAGS]
        return ' '.join(tokens) if tokens else text
    except Exception:
        return text


# ── TF-IDF 의도 분류기 ────────────────────────────────────

# 의도별 예시 문장 — 실제 사용자가 입력할 법한 다양한 표현
INTENT_EXAMPLES: dict[str, list[str]] = {
    'student_create': [
        '추가해줘', '등록해줘', '새로 추가해줘', '원생 추가', '학생 등록',
        '학생 추가해줘', '원생 등록해줘', '신규 원생 추가', '학생 새로 등록',
        '입원 등록해줘', '추가 등록 부탁해', '새 학생 추가',
    ],
    'attendance_set': [
        '결석 처리해줘', '지각 처리해줘', '조퇴 처리해줘', '출석 처리해줘',
        '오늘 안왔어', '학원 빠졌어', '못왔대', '결석했어', '지각했어',
        '조퇴했어', '일찍 갔어', '오늘 없어', '안 온다고 했어',
        '오늘 결석이야', '오늘 지각이야', '결석으로 해줘', '지각으로 처리',
        '빠진다고 했어', '오늘 빠져요', '학원 안온대',
    ],
    'attendance_query': [
        '출석 현황', '결석자 알려줘', '오늘 출석 확인', '누가 왔어',
        '출석률 알려줘', '안 온 학생', '결석한 학생 목록', '오늘 몇 명 왔어',
        '출결 확인해줘', '누가 안왔어', '오늘 출결', '이번주 결석자',
        '출석 현황 보여줘', '결석자 목록', '오늘 출석 체크',
    ],
    'payment_set': [
        '납부 완료', '수납 완료 처리', '돈 받았어', '냈어', '납부했어',
        '수납 처리해줘', '수강료 받았어', '이번달 납부 완료',
        '돈 받음', '결제 완료', '수납했어', '납부 처리해줘',
        '월비 받았어', '수강료 냈대',
    ],
    'payment_query': [
        '미납자 알려줘', '안 낸 학생', '돈 안낸 애들', '납부 안한 학생',
        '미납 현황', '납부 현황', '이번달 미납', '수납 현황',
        '납부율', '안 낸 사람 목록', '수강료 안낸 학생',
        '납부 안된 학생', '이번달 안낸 애들', '미납자 목록',
    ],
    'counseling_create': [
        '상담 예약해줘', '상담 잡아줘', '상담 등록해줘', '상담 일정 잡아',
        '상담 신청해줘', '상담 예약 부탁해', '상담 잡아',
    ],
    'counseling_query': [
        '상담 일정 알려줘', '예정된 상담', '상담 언제야', '상담 현황',
        '상담 목록', '이번주 상담', '다음 상담 일정', '상담 예정',
    ],
    'student_query': [
        '연락처 알려줘', '학부모 번호', '재원생 몇 명이야', '학생 수',
        '전화번호 알려줘', '학부모 연락처', '몇 명이야', '재원생 현황',
        '학생 정보', '총 몇 명', '원생 수 알려줘',
    ],
}

# 모듈 로드 시 분류기 빌드
_tfidf_vectorizer = None
_tfidf_matrix = None
_tfidf_labels: list[str] = []
HAS_TFIDF_MODEL = False

def _build_tfidf():
    global _tfidf_vectorizer, _tfidf_matrix, _tfidf_labels, HAS_TFIDF_MODEL
    if not HAS_SKLEARN:
        return
    try:
        labels, texts = [], []
        for intent, examples in INTENT_EXAMPLES.items():
            for ex in examples:
                labels.append(intent)
                texts.append(morpheme_tokenize(ex))

        # char_wb n-gram: 형태소 분해 후에도 문자 패턴 잡아냄
        vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4), min_df=1)
        X = vec.fit_transform(texts)
        _tfidf_vectorizer = vec
        _tfidf_matrix = X
        _tfidf_labels = labels
        HAS_TFIDF_MODEL = True
    except Exception:
        pass

_build_tfidf()


def classify_intent_tfidf(text: str, threshold: float = 0.12) -> str | None:
    """TF-IDF 코사인 유사도로 의도 분류. threshold 미만이면 None."""
    if not HAS_TFIDF_MODEL or _tfidf_vectorizer is None:
        return None
    try:
        morph = morpheme_tokenize(text)
        vec = _tfidf_vectorizer.transform([morph])
        sims = cosine_similarity(vec, _tfidf_matrix)[0]
        best_idx = int(np.argmax(sims))
        best_score = float(sims[best_idx])
        if best_score >= threshold:
            return _tfidf_labels[best_idx]
    except Exception:
        pass
    return None


# ── 날짜 파싱 ──────────────────────────────────────────────

def parse_date(text: str) -> date | None:
    today = date.today()

    if re.search(r'오늘|today', text): return today
    if re.search(r'어제|yesterday', text): return today - timedelta(days=1)
    if re.search(r'그제|재작일', text): return today - timedelta(days=2)
    if re.search(r'내일|tomorrow', text): return today + timedelta(days=1)
    if re.search(r'모레', text): return today + timedelta(days=2)

    day_map = {'월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6}
    m = re.search(r'다음\s*주?\s*([월화수목금토일])요?일?', text)
    if m:
        target = day_map[m.group(1)]
        delta = (target - today.weekday() + 7) % 7
        return today + timedelta(days=delta if delta > 0 else 7)

    m = re.search(r'이번\s*주?\s*([월화수목금토일])요?일?', text)
    if m:
        target = day_map[m.group(1)]
        return today + timedelta(days=(target - today.weekday()) % 7)

    m = re.search(r'(\d{1,2})월\s*(\d{1,2})일', text)
    if m:
        try:
            d = date(today.year, int(m.group(1)), int(m.group(2)))
            if d < today - timedelta(days=180):
                d = date(today.year + 1, int(m.group(1)), int(m.group(2)))
            return d
        except ValueError:
            pass
    return None


def parse_month(text: str) -> tuple[int, int] | None:
    today = date.today()
    if re.search(r'이번\s*달?|이번\s*월|현재\s*달?', text):
        return (today.year, today.month)
    if re.search(r'지난\s*달?|저번\s*달?|전\s*달?', text):
        d = today.replace(day=1) - timedelta(days=1)
        return (d.year, d.month)
    if re.search(r'다음\s*달?', text):
        return (today.year, today.month + 1) if today.month < 12 else (today.year + 1, 1)
    m = re.search(r'(\d{1,2})월', text)
    if m:
        return (today.year, int(m.group(1)))
    return None


# ── 이름 추출 ─────────────────────────────────────────────

STOP_WORDS = {
    '추가', '등록', '처리', '학생', '원생', '오늘', '내일', '어제', '이번', '지난',
    '출석', '결석', '지각', '조퇴', '납부', '수납', '미납', '상담', '취소', '삭제',
    '수정', '변경', '확인', '조회', '목록', '현황', '정보', '알려', '해줘', '해주세요',
    '다음', '이번달', '지난달', '학원', '선생', '원장', '어떻게', '왔어', '안왔', '빠졌',
}


def extract_name_from_text(text: str, candidates: list[str]) -> str | None:
    """기존 학생 목록에서 이름 매칭 — 정확 포함 우선, rapidfuzz fallback."""
    for name in sorted(candidates, key=len, reverse=True):
        if name in text:
            return name
    if HAS_RAPIDFUZZ:
        words = re.findall(r'[가-힣]{2,4}', text)
        for word in words:
            if word in STOP_WORDS:
                continue
            result = process.extractOne(word, candidates, scorer=fuzz.ratio)
            if result and result[1] >= 80:
                return result[0]
    return None


def extract_new_name(text: str) -> str | None:
    """기존 목록 없이 텍스트에서 이름 후보 추출 (신규 학생 등록용).
    kiwipiepy NNP 태그 우선, 없으면 STOP_WORDS 제외한 첫 한글 단어."""
    kiwi = _get_kiwi()
    if kiwi:
        try:
            result = kiwi.analyze(text)[0][0]
            for t in result:
                if t.tag == 'NNP' and t.form not in STOP_WORDS and len(t.form) >= 2:
                    return t.form
        except Exception:
            pass
    # fallback: STOP_WORDS 제외한 2~4자 한글
    words = re.findall(r'[가-힣]{2,4}', text)
    for w in words:
        if w not in STOP_WORDS:
            return w
    return None


# ── 출결 상태 ─────────────────────────────────────────────

_STATUS_MAP = {
    '출석': 'present', '등원': 'present', '왔어': 'present', '왔대': 'present',
    '결석': 'absent', '안왔': 'absent', '안 왔': 'absent', '빠졌': 'absent',
    '못왔': 'absent', '없어': 'absent', '안와': 'absent',
    '지각': 'late', '늦었': 'late', '늦게': 'late',
    '조퇴': 'early_leave', '일찍': 'early_leave',
}

def detect_attendance_status(text: str) -> str:
    for kw, status in _STATUS_MAP.items():
        if kw in text:
            return status
    return 'absent'


# ── 키워드 fallback ───────────────────────────────────────

_KEYWORD_PATTERNS: list[tuple[str, list[str]]] = [
    ('student_create',   ['추가해줘', '등록해줘', '추가 해줘', '등록 해줘', '학생 추가', '원생 등록']),
    ('attendance_set',   ['결석 처리', '지각 처리', '조퇴 처리', '출석 처리',
                          '결석으로', '출석으로', '결석했', '지각했', '빠졌', '안왔']),
    ('attendance_query', ['출석 현황', '결석자', '오늘 출석', '출결 확인', '안 온 학생']),
    ('payment_set',      ['납부 완료', '수납 완료', '납부했', '수납했', '돈 받았', '냈어']),
    ('payment_query',    ['미납', '납부 안', '안 낸', '미납자', '납부 현황', '수납 현황']),
    ('counseling_create',['상담 예약', '상담 잡아', '상담 등록']),
    ('counseling_query', ['상담 일정', '예정된 상담', '상담 현황', '상담 목록']),
    ('student_query',    ['연락처', '학부모', '몇 명', '재원생', '학생 수']),
]

def _keyword_fallback(text: str) -> str | None:
    for intent, kws in _KEYWORD_PATTERNS:
        for kw in kws:
            if kw in text:
                return intent
    if re.search(r'추가|등록', text) and re.search(r'해줘|해주세요|할게', text):
        return 'student_create'
    if re.search(r'결석|지각|조퇴|출석', text) and re.search(r'처리|했|해줘', text):
        return 'attendance_set'
    if re.search(r'결석|지각|조퇴|출석', text):
        return 'attendance_query'
    if re.search(r'납부|수납|월비|수강료', text) and re.search(r'완료|했|해줘|받았', text):
        return 'payment_set'
    if re.search(r'납부|수납|미납', text):
        return 'payment_query'
    if re.search(r'상담', text):
        return 'counseling_query'
    return None


# ── 메인 파서 ─────────────────────────────────────────────

class ParseResult:
    def __init__(self, intent: str, params: dict[str, Any], confidence: str = 'high'):
        self.intent = intent
        self.params = params
        self.confidence = confidence

    def to_dict(self):
        return {'intent': self.intent, 'params': self.params, 'confidence': self.confidence}


def parse(text: str, student_names: list[str], classroom_names: list[str]) -> ParseResult | None:
    text = text.strip()

    # 1차: TF-IDF (형태소 전처리 포함)
    intent = classify_intent_tfidf(text)

    # 2차 fallback: 키워드 매칭
    if intent is None:
        intent = _keyword_fallback(text)

    if intent is None:
        return None

    params: dict[str, Any] = {}

    # 학생 이름 추출
    student_name = extract_name_from_text(text, student_names)
    if not student_name and intent == 'student_create':
        student_name = extract_new_name(text)
    if student_name:
        params['student_name'] = student_name

    # 반 이름 추출
    cr_name = extract_name_from_text(text, classroom_names)
    if cr_name:
        params['classroom_name'] = cr_name

    # 날짜/월 추출
    target_date = parse_date(text)
    if target_date:
        params['date'] = target_date.isoformat()
    elif intent in ('attendance_set', 'attendance_query'):
        params['date'] = date.today().isoformat()

    month_info = parse_month(text)
    if month_info:
        params['year'], params['month'] = month_info

    # 출결 상태
    if intent == 'attendance_set':
        params['status'] = detect_attendance_status(text)

    # 신뢰도
    confidence = 'high'
    if intent in ('attendance_set', 'payment_set', 'student_create') and 'student_name' not in params:
        confidence = 'low'

    return ParseResult(intent=intent, params=params, confidence=confidence)
