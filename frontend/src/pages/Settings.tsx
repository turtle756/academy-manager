import { useEffect, useState } from 'react';
import { Trash2, UserPlus, Copy, Download, Check, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

interface Invite { id: number; email: string | null; role: string; used: boolean; created_at: string; invite_code: string }
interface Member { user_id: number; name: string; email: string; role: string }

const ROLE_LABEL: Record<string, string> = {
  owner: '원장',
  vice_owner: '부원장',
  teacher: '강사',
};
const ROLE_COLOR: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  vice_owner: 'bg-indigo-100 text-indigo-700',
  teacher: 'bg-blue-100 text-blue-700',
};

export default function SettingsPage() {
  const { academyId, academyRole } = useAuth();
  const isOwner = academyRole === 'owner';

  const [form, setForm] = useState({ name: '', address: '', address_detail: '', phone: '', bank_name: '', bank_account: '', bank_holder: '' });
  const [saved, setSaved] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'teacher' });
  const [showInvite, setShowInvite] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 학원 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const token = localStorage.getItem('token') || '';

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadKiosk = async () => {
    try {
      const res = await api.get('/kiosk/download', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'classmanager-kiosk.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('다운로드 실패');
    }
  };

  useEffect(() => {
    api.get('/academies').then(r => {
      const d = r.data;
      setForm({ name: d.name || '', address: d.address || '', address_detail: d.address_detail || '', phone: d.phone || '', bank_name: d.bank_name || '', bank_account: d.bank_account || '', bank_holder: d.bank_holder || '' });
    }).catch(() => {});
    loadInvites();
    if (isOwner) loadMembers();
  }, []);

  const loadInvites = () => api.get('/invitations').then(r => setInvites(r.data)).catch(() => {});
  const loadMembers = () => api.get('/academies/members').then(r => setMembers(r.data)).catch(() => {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.patch('/academies', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/invitations', { email: inviteForm.email || null, role: inviteForm.role });
      setInviteForm({ email: '', role: 'teacher' });
      setShowInvite(false);
      loadInvites();
      // 링크 생성이면 바로 클립보드에 복사
      if (!inviteForm.email && res.data.invite_code) {
        const link = `${window.location.origin}/join/${res.data.invite_code}`;
        navigator.clipboard.writeText(link);
        alert(`초대 링크가 클립보드에 복사되었습니다.\n\n${link}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || '초대 실패');
    }
  };

  const handleDeleteInvite = async (id: number) => {
    await api.delete(`/invitations/${id}`);
    loadInvites();
  };

  const handleRemoveMember = async (userId: number, name: string) => {
    if (!confirm(`${name}을(를) 구성원에서 제거하시겠습니까?`)) return;
    await api.delete(`/academies/members/${userId}`);
    loadMembers();
  };

  const handleRoleChange = async (userId: number, role: string) => {
    await api.patch(`/academies/members/${userId}/role`, { role });
    loadMembers();
  };

  const handleDeleteAcademy = async () => {
    if (deleteConfirmName !== form.name) return;
    try {
      await api.delete('/academies');
      localStorage.removeItem('academy_id');
      localStorage.removeItem('academy_role');
      localStorage.removeItem('academy_name');
      window.location.href = '/select-academy';
    } catch (err: any) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">설정</h2>

      {/* Academy info */}
      <div className="bg-white rounded-xl border p-6 max-w-lg">
        <h3 className="text-lg font-semibold mb-4">학원 정보</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학원 이름</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <div className="flex gap-2">
              <input value={form.address} readOnly onClick={() => { new (window as any).daum.Postcode({ oncomplete: (data: any) => { setForm({...form, address: data.roadAddress || data.jibunAddress}); } }).open(); }} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-gray-50" placeholder="클릭하여 주소 검색" />
              <button type="button" onClick={() => { new (window as any).daum.Postcode({ oncomplete: (data: any) => { setForm({...form, address: data.roadAddress || data.jibunAddress}); } }).open(); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm whitespace-nowrap">주소 검색</button>
            </div>
            {form.address && (
              <input value={form.address_detail} onChange={e => setForm({...form, address_detail: e.target.value})} className="w-full mt-2 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="상세주소 (동/호수 등)" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <hr />
          <p className="text-sm text-gray-500">학원비 입금 계좌</p>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="은행" className="px-3 py-2 border rounded-lg outline-none" />
            <input value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} placeholder="계좌번호" className="px-3 py-2 border rounded-lg outline-none" />
            <input value={form.bank_holder} onChange={e => setForm({...form, bank_holder: e.target.value})} placeholder="예금주" className="px-3 py-2 border rounded-lg outline-none" />
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {saved ? '저장됨!' : '저장'}
          </button>
        </form>
      </div>

      {/* Members (owner only) */}
      {isOwner && (
        <div className="bg-white rounded-xl border p-6 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">구성원 관리</h3>
            <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <UserPlus size={14} /> 초대
            </button>
          </div>

          {showInvite && (
            <form onSubmit={handleInvite} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <input
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                placeholder="Google 이메일 (비워두면 링크로 초대)"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={inviteForm.role}
                onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg outline-none"
              >
                <option value="teacher">강사</option>
                <option value="vice_owner">부원장 (수납·학생·출석 관리 가능)</option>
                <option value="owner">원장 (모든 권한)</option>
              </select>
              <p className="text-xs text-gray-400">
                이메일을 비워두면 초대 링크가 생성됩니다. 링크를 받은 사람이 Google 로그인 시 자동으로 이 학원에 배정됩니다.
              </p>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  {inviteForm.email ? '이메일로 초대' : '링크 생성 + 복사'}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 border rounded-lg text-sm">취소</button>
              </div>
            </form>
          )}

          {/* 현재 구성원 */}
          {members.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">현재 구성원</p>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-xs text-gray-400 ml-1">{m.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.user_id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 outline-none ${ROLE_COLOR[m.role] || 'bg-gray-100'}`}
                      >
                        <option value="teacher">강사</option>
                        <option value="vice_owner">부원장</option>
                        <option value="owner">원장</option>
                      </select>
                      <button onClick={() => handleRemoveMember(m.user_id, m.name)} className="p-1 hover:bg-red-50 rounded">
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 초대 대기 목록 */}
          {invites.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">초대 대기</p>
              <div className="space-y-2">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{inv.email || '링크 초대'}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${ROLE_COLOR[inv.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABEL[inv.role] || inv.role}
                      </span>
                      {inv.used && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">가입 완료</span>}
                    </div>
                    {!inv.used && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/join/${inv.invite_code}`;
                            navigator.clipboard.writeText(link);
                            setCopiedField(`inv-${inv.id}`);
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          className="p-1.5 hover:bg-blue-50 rounded text-blue-500"
                          title="링크 복사"
                        >
                          {copiedField === `inv-${inv.id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => handleDeleteInvite(inv.id)} className="p-1.5 hover:bg-red-50 rounded">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && invites.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">구성원이 없습니다</p>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
            <p><span className="font-medium text-gray-700">강사</span> — 출석·성적·상담·학생 조회</p>
            <p><span className="font-medium text-indigo-700">부원장</span> — 강사 권한 + 수납·반 관리·학원 정보 수정</p>
            <p><span className="font-medium text-purple-700">원장</span> — 모든 권한 + 구성원 관리·학원 삭제</p>
          </div>
        </div>
      )}

      {/* NFC 키오스크 */}
      <div className="bg-white rounded-xl border p-6 max-w-lg">
        <h3 className="text-lg font-semibold mb-1">NFC 키오스크 프로그램</h3>
        <p className="text-sm text-gray-500 mb-5">ACR1252U USB 리더기를 사용하는 학원용 출석 체크 프로그램입니다.</p>

        <button onClick={downloadKiosk} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-5">
          <Download size={16} /> 키오스크 프로그램 다운로드
        </button>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">JWT 토큰</label>
            <div className="flex gap-2">
              <input readOnly value={token} className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-xs font-mono truncate outline-none" />
              <button onClick={() => copyToClipboard(token, 'token')} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1">
                {copiedField === 'token' ? <><Check size={14} className="text-green-600" /> 복사됨</> : <><Copy size={14} /> 복사</>}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">학원 ID</label>
            <div className="flex gap-2">
              <input readOnly value={academyId || ''} className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm font-mono outline-none" />
              <button onClick={() => copyToClipboard(String(academyId || ''), 'academy')} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1">
                {copiedField === 'academy' ? <><Check size={14} className="text-green-600" /> 복사됨</> : <><Copy size={14} /> 복사</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 학원 삭제 (원장만) */}
      {isOwner && (
        <div className="bg-white rounded-xl border border-red-200 p-6 max-w-lg">
          <h3 className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} /> 학원 삭제
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            학원을 삭제하면 모든 학생·수납·출석·성적 데이터가 영구적으로 삭제됩니다. 복구할 수 없습니다.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            학원 삭제
          </button>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} /> 학원 삭제 확인
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              이 작업은 되돌릴 수 없습니다. 계속하려면 아래에 학원 이름 <strong>{form.name}</strong>을 정확히 입력하세요.
            </p>
            <input
              value={deleteConfirmName}
              onChange={e => setDeleteConfirmName(e.target.value)}
              placeholder={form.name}
              className="w-full px-3 py-2 border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-400 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAcademy}
                disabled={deleteConfirmName !== form.name}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                영구 삭제
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmName(''); }} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
