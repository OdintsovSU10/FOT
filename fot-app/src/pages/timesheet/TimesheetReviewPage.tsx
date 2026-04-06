import { type FC, useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Tabs } from '../../components/ui/Tabs';
import {
  timesheetApprovalService,
  type ITimesheetApproval,
} from '../../services/timesheetApprovalService';
import { apiClient } from '../../api/client';
import './TimesheetReviewPage.css';

interface IDeptMap { [id: string]: string }

const TAB_STATUSES = ['submitted', 'approved', 'rejected'] as const;
const TAB_LABELS = ['На проверке', 'Утверждённые', 'Отклонённые'];
const EMPTY_MESSAGES = ['Нет табелей на проверке', 'Нет утверждённых табелей', 'Нет отклонённых табелей'];

const formatPeriod = (period: string) => {
  const [y, m] = period.split('-');
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
};

export const TimesheetReviewPage: FC = () => {
  const [approvals, setApprovals] = useState<ITimesheetApproval[]>([]);
  const [deptMap, setDeptMap] = useState<IDeptMap>({});
  const [loading, setLoading] = useState(true);
  const [commentId, setCommentId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const status = TAB_STATUSES[activeTab];
      const data = await timesheetApprovalService.getByStatus(status);
      setApprovals(data);

      // Загружаем названия отделов
      const res = await apiClient.get<{ data: { departments: Array<{ id: string; name: string; children: unknown[] }> } }>('/structure');
      const map: IDeptMap = {};
      const flatten = (nodes: Array<{ id: string; name: string; children: unknown[] }>) => {
        for (const n of nodes) {
          map[n.id] = n.name;
          if (Array.isArray(n.children)) flatten(n.children as typeof nodes);
        }
      };
      flatten(res.data?.departments || []);
      setDeptMap(map);
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: number) => {
    try {
      await timesheetApprovalService.approve(id, comment || undefined);
      setCommentId(null);
      setComment('');
      await loadData();
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await timesheetApprovalService.reject(id, comment || undefined);
      setCommentId(null);
      setComment('');
      await loadData();
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setCommentId(null);
    setComment('');
  };

  const isSubmittedTab = activeTab === 0;

  return (
    <div className="tsr-page">
      <h1 className="tsr-title">Проверка табелей</h1>

      <Tabs tabs={TAB_LABELS} activeTab={activeTab} onTabChange={handleTabChange} />

      {loading ? (
        <div className="tsr-loading">Загрузка...</div>
      ) : approvals.length === 0 ? (
        <div className="tsr-empty">{EMPTY_MESSAGES[activeTab]}</div>
      ) : (
        <div className="tsr-list">
          {approvals.map(a => (
            <div key={a.id} className={`tsr-card ${!isSubmittedTab ? `tsr-card--${a.status}` : ''}`}>
              <div className="tsr-card-info">
                <div className="tsr-card-dept">{deptMap[a.department_id] || a.department_id}</div>
                <div className="tsr-card-period">
                  <Clock size={14} /> {formatPeriod(a.period)}
                </div>
                {isSubmittedTab && a.submitted_at && (
                  <div className="tsr-card-date">
                    Подан: {new Date(a.submitted_at).toLocaleDateString('ru-RU')}
                  </div>
                )}
                {!isSubmittedTab && a.reviewed_at && (
                  <div className="tsr-card-date">
                    {a.status === 'approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {' '}{a.status === 'approved' ? 'Утверждён' : 'Отклонён'}: {new Date(a.reviewed_at).toLocaleDateString('ru-RU')}
                  </div>
                )}
                {!isSubmittedTab && a.review_comment && (
                  <div className="tsr-card-comment">{a.review_comment}</div>
                )}
              </div>

              {isSubmittedTab && (
                <div className="tsr-card-actions">
                  {commentId === a.id ? (
                    <div className="tsr-comment-form">
                      <input
                        className="tsr-comment-input"
                        placeholder="Комментарий..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                      <button className="tsr-btn approve" onClick={() => handleApprove(a.id)}>
                        <Check size={14} /> Утвердить
                      </button>
                      <button className="tsr-btn reject" onClick={() => handleReject(a.id)}>
                        <X size={14} /> Отклонить
                      </button>
                    </div>
                  ) : (
                    <>
                      <button className="tsr-btn approve" onClick={() => handleApprove(a.id)}>
                        <Check size={14} /> Утвердить
                      </button>
                      <button className="tsr-btn reject" onClick={() => setCommentId(a.id)}>
                        <X size={14} /> Отклонить
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
