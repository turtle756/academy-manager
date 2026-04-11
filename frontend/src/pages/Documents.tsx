import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import api from '../lib/api';

interface Student { id: number; name: string; school: string; grade: string }

function getMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Documents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [month, setMonth] = useState(getMonthStr(new Date()));
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => { api.get('/students').then(r => setStudents(r.data)); }, []);

  const download = async (url: string, filename: string, docType: string) => {
    setLoading(docType);
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    } catch (err: any) {
      alert(err.response?.data?.detail || '생성 실패');
    } finally {
      setLoading(null);
    }
  };

  const downloadEnrollmentCert = () => {
    if (!selectedStudent) return alert('학생을 선택해주세요');
    const s = students.find(s => s.id === Number(selectedStudent));
    download(
      `/documents/enrollment-cert?student_id=${selectedStudent}`,
      `재원증명서_${s?.name || ''}.xlsx`,
      'enrollment',
    );
  };

  const downloadPaymentCert = () => {
    if (!selectedStudent) return alert('학생을 선택해주세요');
    const s = students.find(s => s.id === Number(selectedStudent));
    download(
      `/documents/payment-cert?student_id=${selectedStudent}&month=${month}`,
      `납부확인서_${s?.name || ''}_${month}.xlsx`,
      'payment',
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">서류 생성</h2>

      {/* 학생 선택 공통 */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-700">학생 선택</label>
        <select
          value={selectedStudent}
          onChange={e => setSelectedStudent(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">-- 학생을 선택하세요 --</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.school ? ` (${s.school} ${s.grade})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 재원증명서 */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText size={20} className="text-blue-600" /></div>
            <div>
              <h3 className="text-lg font-semibold">재원증명서</h3>
              <p className="text-xs text-gray-400">Enrollment Certificate</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            학생이 현재 학원에 재원 중임을 증명하는 서류입니다.
            학원명, 학생 정보, 수강반, 등록일이 포함됩니다.
          </p>
          <button
            onClick={downloadEnrollmentCert}
            disabled={loading === 'enrollment'}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm w-full justify-center disabled:opacity-50"
          >
            <Download size={16} />
            {loading === 'enrollment' ? '생성 중...' : '재원증명서 다운로드'}
          </button>
        </div>

        {/* 납부확인서 */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg"><FileText size={20} className="text-green-600" /></div>
            <div>
              <h3 className="text-lg font-semibold">납부확인서</h3>
              <p className="text-xs text-gray-400">Payment Receipt</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            해당 월의 수강료 납부 내역을 확인하는 서류입니다.
          </p>
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">납부 월</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <button
            onClick={downloadPaymentCert}
            disabled={loading === 'payment'}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm w-full justify-center disabled:opacity-50"
          >
            <Download size={16} />
            {loading === 'payment' ? '생성 중...' : '납부확인서 다운로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
