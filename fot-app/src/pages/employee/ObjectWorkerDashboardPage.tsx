import type { CSSProperties, FC } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const baseCardStyle: CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 20,
  padding: 20,
};

const actionCards = [
  { path: '/employee/requests', title: 'Заявления', description: 'Подать и отследить статус своих заявлений.' },
  { path: '/employee/timesheet', title: 'Табель', description: 'Посмотреть смены, часы и корректировки.' },
  { path: '/employee/documents', title: 'Документы', description: 'Доступ к личным документам и загрузкам.' },
  { path: '/employee/payslips', title: 'Расчётные листки', description: 'История начислений по периодам.' },
  { path: '/employee/payments', title: 'Выплаты', description: 'Фактические выплаты и даты перечислений.' },
];

export const ObjectWorkerDashboardPage: FC = () => {
  const { profile, canViewPage, isTwoFactorEnabled, getRoleLabel } = useAuth();

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <section style={{ ...baseCardStyle, display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28 }}>Личный кабинет рабочего</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>
            Здесь собраны только ваши рабочие разделы без офисных модулей.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={baseCardStyle}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Сотрудник</div>
            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>{profile?.full_name || '—'}</div>
          </div>
          <div style={baseCardStyle}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Роль</div>
            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
              {profile?.position_type ? getRoleLabel(profile.position_type) : '—'}
            </div>
          </div>
          <div style={baseCardStyle}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Должность</div>
            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>{profile?.imported_position || '—'}</div>
          </div>
          <div style={baseCardStyle}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Безопасность</div>
            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
              {isTwoFactorEnabled ? '2FA включён' : '2FA не включён'}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {actionCards
          .filter(card => canViewPage(card.path))
          .map(card => (
            <Link
              key={card.path}
              to={card.path}
              style={{
                ...baseCardStyle,
                color: 'inherit',
                textDecoration: 'none',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{card.title}</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{card.description}</div>
            </Link>
          ))}
      </section>
    </div>
  );
};
