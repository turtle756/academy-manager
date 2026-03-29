import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';

export default function Kiosk() {
  const [params] = useSearchParams();
  const classroomId = params.get('classroom');
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<{ success: boolean; name?: string; message?: string } | null>(null);
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

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin(pin + d);
  };

  const handleDelete = () => setPin(pin.slice(0, -1));

  const handleSubmit = async () => {
    if (pin.length !== 4 || !classroomId) return;
    try {
      const res = await api.post('/attendance/check-in/pin', {
        pin_code: pin,
        classroom_id: Number(classroomId),
      });
      setResult({ success: true, name: res.data.student_name });
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.detail || '오류가 발생했습니다' });
    }
  };

  if (result) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="text-center">
          <p className="text-6xl mb-4">{result.success ? '✅' : '❌'}</p>
          <p className="text-3xl font-bold mb-2">{result.success ? '출석 완료!' : '실패'}</p>
          <p className="text-xl text-gray-600">{result.success ? `${result.name} 학생` : result.message}</p>
          <p className="text-sm text-gray-400 mt-4">3초 후 돌아갑니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">출석체크</h1>
      <p className="text-gray-500 mb-8">PIN 4자리를 입력하세요</p>

      {/* PIN display */}
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-3xl font-bold ${
            pin[i] ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white'
          }`}>
            {pin[i] || ''}
          </div>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => handleDigit(d)} className="w-20 h-20 rounded-2xl bg-white border border-gray-200 text-2xl font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors">
            {d}
          </button>
        ))}
        <button onClick={handleDelete} className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 text-lg hover:bg-gray-200 transition-colors">
          ←
        </button>
        <button onClick={() => handleDigit('0')} className="w-20 h-20 rounded-2xl bg-white border border-gray-200 text-2xl font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors">
          0
        </button>
        <button onClick={handleSubmit} className="w-20 h-20 rounded-2xl bg-blue-600 text-white text-lg font-semibold hover:bg-blue-700 transition-colors">
          ✓
        </button>
      </div>

      <p className="text-lg text-gray-400 font-mono">
        {time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  );
}
