import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Undo2, Zap, AlertCircle, Table2 } from 'lucide-react';
import api from '../lib/api';

interface Invoice {
  id: number;
  student_id: number;
  student_name: string;
  parent_phone: string | null;
  amount: number;
  description: string | null;
  status: string;
  due_date: string;
  paid_date: string | null;
  days_overdue: number;
}

interface Summary {
  month: string;
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  total_count: number;
  paid_count: number;
  unpaid_count: number;
  paid_rate: number;
}

interface YearlyStudent {
  id: number;
  name: string;
  months: (string | null)[];
}

type View = 'month' | 'yearly';

function getMonthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function Payments() {
  const [view, setView] = useState<View>('month');
  const [month, setMonth] = useState(getMonthStr(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [yearly, setYearly] = useState<YearlyStudent[]>([]);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');


  const loadMonth = async () => {
    try {
      const [s, inv] = await Promise.all([
        api.get(`/payments/summary`, { params: { month } }),
        api.get(`/payments/invoices`, { params: { month } }),
      ]);
      setSummary(s.data);
      setInvoices(inv.data);
    } catch (err) { console.error(err); }
  };

  const loadYearly = async () => {
    try {
      const res = await api.get('/payments/yearly-matrix', { params: { year } });
      setYearly(res.data.students);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (view === 'month') loadMonth();
    else loadYearly();
  }, [month, year, view]);

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const newDate = new Date(y, m - 1 + delta, 1);
    setMonth(getMonthStr(newDate));
  };

  const bulkGenerate = async () => {
    if (!confirm(`${month} 청구서를 일괄 생성합니다.\n반별 월 수강료 기준으로 자동 생성됩니다. 계속하시겠습니까?`)) return;
    try {
      const res = await api.post('/payments/invoices/bulk-generate', { month, due_day: 10 });
      alert(`생성: ${res.data.created}건\n스킵(이미 존재): ${res.data.skipped}건`);
      loadMonth();
    } catch (err: any) {
      alert(err.response?.data?.detail || '생성 실패');
    }
  };

  const quickPay = async (inv: Invoice, method: string) => {
    try {
      await api.post(`/payments/invoices/${inv.id}/pay`, {
        amount: inv.amount,
        method,
      });
      loadMonth();
    } catch (err: any) {
      alert(err.response?.data?.detail || '처리 실패');
    }
  };

  const revertPay = async (inv: Invoice) => {
    if (!confirm('수납 처리를 취소하시겠습니까?')) return;
    try {
      await api.post(`/payments/invoices/${inv.id}/unpay`);
      loadMonth();
    } catch (err: any) {
      alert(err.response?.data?.detail || '처리 실패');
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'unpaid') return inv.status !== 'paid';
    if (filter === 'paid') return inv.status === 'paid';
    return true;
  });

  const monthLabel = month.replace('-', '년 ') + '월';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">수납 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 rounded-lg text-sm ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            월별 뷰
          </button>
          <button
            onClick={() => setView('yearly')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${view === 'yearly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            <Table2 size={14} /> 연간 매트릭스
          </button>
        </div>
      </div>

      {view === 'month' && (
        <>
          {/* 월 선택 + 액션 */}
          <div className="bg-white rounded-xl border p-4 mb-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
              <span className="px-3 font-bold text-lg">{monthLabel}</span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
              <button onClick={() => setMonth(getMonthStr(new Date()))} className="ml-2 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">이달</button>
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={bulkGenerate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Zap size={14} /> {month.split('-')[1]}월 일괄 청구
              </button>
            </div>
          </div>

          {/* 요약 카드 */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">총 청구</p>
                <p className="text-2xl font-bold">{summary.total_amount.toLocaleString()}원</p>
                <p className="text-xs text-gray-400 mt-1">{summary.total_count}건</p>
              </div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <p className="text-xs text-green-700">수납 완료</p>
                <p className="text-2xl font-bold text-green-700">{summary.paid_amount.toLocaleString()}원</p>
                <p className="text-xs text-green-600 mt-1">{summary.paid_count}건</p>
              </div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                <p className="text-xs text-red-700">미납</p>
                <p className="text-2xl font-bold text-red-700">{summary.unpaid_amount.toLocaleString()}원</p>
                <p className="text-xs text-red-600 mt-1">{summary.unpaid_count}건</p>
              </div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <p className="text-xs text-blue-700">수납률</p>
                <p className="text-2xl font-bold text-blue-700">{summary.paid_rate}%</p>
                <div className="mt-2 bg-blue-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-full" style={{ width: `${summary.paid_rate}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* 필터 */}
          <div className="flex gap-2 mb-3">
            {([['all', '전체'], ['unpaid', '미납'], ['paid', '수납완료']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm ${filter === key ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 청구서 목록 */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">학생</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">내역</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">금액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">납기</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.student_name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{inv.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{inv.amount.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-gray-500">{inv.due_date}</td>
                    <td className="px-4 py-3">
                      {inv.status === 'paid' ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">납부</span>
                      ) : inv.days_overdue > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <AlertCircle size={10} /> 연체 D+{inv.days_overdue}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">대기</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.status === 'paid' ? (
                        <button
                          onClick={() => revertPay(inv)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                          title="수납 취소"
                        >
                          <Undo2 size={12} /> 취소
                        </button>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => quickPay(inv, '현금')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">현금</button>
                          <button onClick={() => quickPay(inv, '카드')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">카드</button>
                          <button onClick={() => quickPay(inv, '이체')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">이체</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredInvoices.length === 0 && (
              <p className="text-center text-gray-400 py-12">
                청구서가 없습니다. "일괄 청구" 버튼으로 생성하세요.
              </p>
            )}
          </div>
        </>
      )}

      {view === 'yearly' && (
        <>
          <div className="bg-white rounded-xl border p-4 mb-4 flex items-center gap-3">
            <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
            <span className="px-3 font-bold text-lg">{year}년</span>
            <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 sticky left-0 bg-gray-50">학생</th>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <th key={m} className="px-3 py-3 font-medium text-gray-600 text-center">{m}월</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearly.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white">{s.name}</td>
                    {s.months.map((status, i) => (
                      <td key={i} className="px-3 py-3 text-center">
                        {status === 'paid' ? (
                          <Check size={16} className="text-green-600 mx-auto" />
                        ) : status === 'pending' || status === 'overdue' ? (
                          <span className="inline-block w-4 h-4 rounded-full bg-red-400" title="미납" />
                        ) : (
                          <span className="text-gray-200">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {yearly.length === 0 && (
              <p className="text-center text-gray-400 py-12">학생이 없습니다</p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            <Check size={12} className="inline text-green-600" /> 납부 완료 ·
            <span className="inline-block w-2 h-2 rounded-full bg-red-400 mx-1" /> 미납 ·
            <span className="text-gray-300">·</span> 청구 없음
          </p>
        </>
      )}
    </div>
  );
}
