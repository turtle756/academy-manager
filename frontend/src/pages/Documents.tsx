import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import api from '../lib/api';

interface Classroom { id: number; name: string }

export default function Documents() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { api.get('/classrooms').then(r => setClassrooms(r.data)); }, []);

  const downloadAttendanceSheet = async () => {
    if (!selectedClassroom) return alert('반을 선택해주세요');
    const res = await api.get(`/documents/attendance-sheet?classroom_id=${selectedClassroom}&month=${month}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `출석부_${month}.xlsx`;
    a.click();
  };

  const downloadRoster = async () => {
    const res = await api.get('/documents/student-roster', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = '수강생대장.xlsx';
    a.click();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">서류 생성</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText size={20} className="text-blue-600" /></div>
            <h3 className="text-lg font-semibold">출석부</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">교육청 제출용 월별 출석부를 Excel로 생성합니다.</p>
          <div className="space-y-3 mb-4">
            <select value={selectedClassroom} onChange={e => setSelectedClassroom(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none">
              <option value="">반 선택</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
          </div>
          <button onClick={downloadAttendanceSheet} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm w-full justify-center">
            <Download size={16} /> 출석부 다운로드
          </button>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg"><FileText size={20} className="text-green-600" /></div>
            <h3 className="text-lg font-semibold">수강생 대장</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">전체 수강생 명단을 Excel로 생성합니다.</p>
          <button onClick={downloadRoster} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm w-full justify-center mt-[88px]">
            <Download size={16} /> 수강생 대장 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
