import { useState, useEffect } from 'react';
import { Nfc, Hash } from 'lucide-react';
import api from '../lib/api';

type Mode = 'nfc' | 'pin';

interface CheckResult {
  success: boolean;
  name?: string;
  status?: string;
  message?: string;
}

export default function Kiosk() {
  const [mode, setMode] = useState<Mode>('nfc');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pin, setPin] = useState('');
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => { setResult(null); setPin(''); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // Web NFC listener
  useEffect(() => {
    if (mode !== 'nfc' || !('NDEFReader' in window)) return;
    let abortController: AbortController | null = null;
    const startNFC = async () => {
      try {
        const ndef = new (window as any).NDEFReader();
        abortController = new AbortController();
        await ndef.scan({ signal: abortController.signal });
        ndef.onreading = (event: any) => {
          const uid = event.serialNumber?.replace(/:/g, '').toUpperCase();
          if (uid) handleNFCScan(uid);
        };
      } catch (err) { console.error('NFC error:', err); }
    };
    startNFC();
    return () => { abortController?.abort(); };
  }, [mode]);

  // Android Bridge callback
  useEffect(() => {
    (window as any).onKioskNfcScan = (uid: string) => { handleNFCScan(uid); };
  }, []);

  const handleNFCScan = async (uid: string) => {
    try {
      const res = await api.post('/attendance/check-in/nfc', { nfc_uid: uid });
      setResult({ success: true, name: res.data.student_name, status: res.data.status });
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.detail || '인식 실패' });
    }
  };

  const handlePIN = async () => {
    if (pin.length !== 4) return;
    try {
      const res = await api.post('/attendance/check-in/pin', { pin_code: pin, classroom_id: 0 });
      setResult({ success: true, name: res.data.student_name, status: res.data.status });
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.detail || '인식 실패' });
    }
  };

  if (result) {
    const isAlready = result.status === 'already_checked';
    return (
      <div className={`min-h-screen flex items-center justify-center ${result.success ? (isAlready ? 'bg-yellow-50' : 'bg-green-50') : 'bg-red-50'}`}>
        <div className="text-center">
          <p className="text-7xl mb-6">{result.success ? (isAlready ? '⚠️' : '✅') : '❌'}</p>
          <p className="text-4xl font-bold mb-3">{result.success ? (isAlready ? '이미 출석됨' : '출석 완료!') : '실패'}</p>
          <p className="text-2xl text-gray-600">{result.success ? `${result.name} 학생` : result.message}</p>
          <p className="text-sm text-gray-400 mt-6">3초 후 돌아갑니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">출석체크</h1>
        <p className="text-gray-400 font-mono text-lg">
          {time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>

      <div className="flex bg-gray-800 px-4 pb-4 gap-2">
        {[
          { key: 'nfc' as const, icon: Nfc, label: 'NFC 터치' },
          { key: 'pin' as const, icon: Hash, label: 'PIN 입력' },
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${
              mode === m.key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}>
            <m.icon size={18} /> {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        {mode === 'nfc' && (
          <div className="text-center">
            <div className="w-48 h-48 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-8 animate-pulse">
              <Nfc size={80} className="text-blue-400" />
            </div>
            <p className="text-white text-2xl font-semibold mb-2">NFC 카드를 터치하세요</p>
            <p className="text-gray-400">기기 뒷면에 카드를 가까이 대세요</p>
          </div>
        )}

        {mode === 'pin' && (
          <div className="text-center">
            <p className="text-white text-xl mb-6">PIN 4자리를 입력하세요</p>
            <div className="flex gap-4 justify-center mb-8">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-3xl font-bold ${
                  pin[i] ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-gray-600 bg-gray-800'
                }`}>{pin[i] ? '●' : ''}</div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button key={d} onClick={() => pin.length < 4 && setPin(pin + d)}
                  className="w-20 h-20 rounded-2xl bg-gray-700 text-white text-2xl font-semibold hover:bg-gray-600 active:bg-gray-500">{d}</button>
              ))}
              <button onClick={() => setPin(pin.slice(0, -1))} className="w-20 h-20 rounded-2xl bg-gray-800 text-gray-400 text-lg hover:bg-gray-700">←</button>
              <button onClick={() => pin.length < 4 && setPin(pin + '0')} className="w-20 h-20 rounded-2xl bg-gray-700 text-white text-2xl font-semibold hover:bg-gray-600 active:bg-gray-500">0</button>
              <button onClick={handlePIN} className="w-20 h-20 rounded-2xl bg-blue-600 text-white text-lg font-semibold hover:bg-blue-700">✓</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
