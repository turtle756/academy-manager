import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import api from '../lib/api';

interface Invoice { id: number; student_id: number; student_name: string; amount: number; description: string; status: string; due_date: string; paid_date: string | null }
interface Student { id: number; name: string }

const statusLabel: Record<string, string> = { pending: '대기', paid: '납부', overdue: '미납' };
const statusStyle: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700' };

export default function Payments() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_ids: [] as number[], amount: '', description: '', due_date: '' });

  const load = () => api.get('/payments/invoices').then(r => setInvoices(r.data));
  useEffect(() => { load(); api.get('/students').then(r => setStudents(r.data)); }, []);

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const unpaidAmount = totalAmount - paidAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.student_ids.length === 1) {
      await api.post('/payments/invoices', { student_id: form.student_ids[0], amount: Number(form.amount), description: form.description, due_date: form.due_date });
    } else {
      await api.post('/payments/invoices/bulk', { student_ids: form.student_ids, amount: Number(form.amount), description: form.description, due_date: form.due_date });
    }
    setShowForm(false);
    load();
  };

  const confirmPay = async (id: number, amount: number) => {
    await api.post(`/payments/invoices/${id}/pay`, { amount, method: '계좌이체' });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">수납 관리</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} /> 청구서 발송
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">총 청구</p>
          <p className="text-xl font-bold">{totalAmount.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">납부 완료</p>
          <p className="text-xl font-bold text-green-600">{paidAmount.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">미납</p>
          <p className="text-xl font-bold text-red-600">{unpaidAmount.toLocaleString()}원</p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">청구서 생성</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">학생 선택</label>
                <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.student_ids.includes(s.id)} onChange={e => {
                        if (e.target.checked) setForm({...form, student_ids: [...form.student_ids, s.id]});
                        else setForm({...form, student_ids: form.student_ids.filter(id => id !== s.id)});
                      }} />
                      <span className="text-sm">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <input required type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="금액 (원)" className="w-full px-3 py-2 border rounded-lg outline-none" />
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="설명 (예: 3월 수학 수업료)" className="w-full px-3 py-2 border rounded-lg outline-none" />
              <input required type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none" />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg">생성</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">학생</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">금액</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">설명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">납부일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{inv.student_name}</td>
                <td className="px-4 py-3">{inv.amount.toLocaleString()}원</td>
                <td className="px-4 py-3 text-gray-500">{inv.description}</td>
                <td className="px-4 py-3 text-gray-500">{inv.due_date}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[inv.status]}`}>{statusLabel[inv.status]}</span></td>
                <td className="px-4 py-3">
                  {inv.status !== 'paid' && (
                    <button onClick={() => confirmPay(inv.id, inv.amount)} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800">
                      <Check size={14} /> 납부 확인
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
