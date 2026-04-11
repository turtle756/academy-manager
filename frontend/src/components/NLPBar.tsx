import { useState, useRef, useEffect } from 'react';
import { MessageSquareDot, X, Send, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';

interface NLPResult {
  ok: boolean;
  message: string;
  hint?: string;
  chips?: string[];
  intent?: string;
  data?: any;
}

const DEFAULT_CHIPS = ['오늘 출석 현황', '이번달 미납자', '예정된 상담', '재원생 몇 명?'];

export default function NLPBar() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<NLPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setResult(null);
      setText('');
    }
  }, [open]);

  const submit = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setText(trimmed);
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/nlp', { text: trimmed });
      setResult(res.data);
    } catch (e: any) {
      setResult({ ok: false, message: '오류가 발생했습니다. 다시 시도해주세요.' });
    } finally {
      setLoading(false);
    }
  };

  const loadHints = async () => {
    if (hints.length > 0) { setShowHints(true); return; }
    try {
      const res = await api.get('/nlp/hints');
      setHints(res.data.categories);
      setShowHints(true);
    } catch {}
  };

  const chips = result?.chips ?? DEFAULT_CHIPS;

  return (
    <>
      {/* 플로팅 버튼 (닫혔을 때) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all text-sm font-medium"
        >
          <MessageSquareDot size={18} />
          AI 명령
        </button>
      )}

      {/* 명령창 */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquareDot size={16} />
              AI 명령
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-blue-700 rounded">
              <X size={16} />
            </button>
          </div>

          {/* 결과 영역 */}
          {result && (
            <div className={`px-4 py-3 text-sm border-b ${result.ok ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'}`}>
              <p className="font-medium">{result.message}</p>
              {result.hint && <p className="text-xs mt-1 opacity-70">{result.hint}</p>}
            </div>
          )}

          {/* 빠른 칩 */}
          <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => submit(chip)}
                className="px-2.5 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 rounded-full text-xs transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* 입력 */}
          <div className="px-3 pb-3 pt-1">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit(text)}
                placeholder="명령을 입력하세요..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={() => submit(text)}
                disabled={loading || !text.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* 사용 가이드 토글 */}
          <div className="border-t">
            <button
              onClick={() => showHints ? setShowHints(false) : loadHints()}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
            >
              사용 예시 보기
              {showHints ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {showHints && hints.length > 0 && (
              <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
                {hints.map((cat) => (
                  <div key={cat.name}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{cat.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {cat.examples.map((ex: string) => (
                        <button
                          key={ex}
                          onClick={() => { submit(ex); setShowHints(false); }}
                          className="px-2 py-0.5 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 rounded text-xs"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
