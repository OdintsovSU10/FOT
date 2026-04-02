import { useState, useRef, useEffect, type FC } from 'react';

interface IDateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

/** Разбивает YYYY-MM-DD на [day, month, year] строки */
const parse = (iso: string): [string, string, string] => {
  const [y = '', m = '', d = ''] = iso.split('-');
  return [d, m, y];
};

/** Собирает обратно YYYY-MM-DD */
const build = (day: string, month: string, year: string): string =>
  `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

export const DateInput: FC<IDateInputProps> = ({ value, onChange, className }) => {
  const [day, month, year] = parse(value);
  const [d, setD] = useState(day);
  const [m, setM] = useState(month);
  const [y, setY] = useState(year);

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Синхронизация с внешним value
  useEffect(() => {
    const [nd, nm, ny] = parse(value);
    setD(nd);
    setM(nm);
    setY(ny);
  }, [value]);

  const emit = (nd: string, nm: string, ny: string) => {
    if (nd.length >= 1 && nm.length >= 1 && ny.length >= 1) {
      onChange(build(nd, nm, ny));
    }
  };

  const handleDay = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setD(clean);
    if (clean.length === 2) {
      monthRef.current?.focus();
      monthRef.current?.select();
    }
    emit(clean, m, y);
  };

  const handleMonth = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setM(clean);
    if (clean.length === 2) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
    emit(d, clean, y);
  };

  const handleYear = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setY(clean);
    emit(d, m, clean);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'day' | 'month' | 'year',
  ) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      if (input.value.length === 0) {
        e.preventDefault();
        if (field === 'year') {
          monthRef.current?.focus();
        } else if (field === 'month') {
          dayRef.current?.focus();
        }
      }
    }
  };

  return (
    <div className={`date-input-group ${className || ''}`}>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        className="date-input-segment date-input-dd"
        value={d}
        onChange={e => handleDay(e.target.value)}
        onKeyDown={e => handleKeyDown(e, 'day')}
        onFocus={e => e.target.select()}
        placeholder="ДД"
        maxLength={2}
      />
      <span className="date-input-dot">.</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        className="date-input-segment date-input-mm"
        value={m}
        onChange={e => handleMonth(e.target.value)}
        onKeyDown={e => handleKeyDown(e, 'month')}
        onFocus={e => e.target.select()}
        placeholder="ММ"
        maxLength={2}
      />
      <span className="date-input-dot">.</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        className="date-input-segment date-input-yyyy"
        value={y}
        onChange={e => handleYear(e.target.value)}
        onKeyDown={e => handleKeyDown(e, 'year')}
        onFocus={e => e.target.select()}
        placeholder="ГГГГ"
        maxLength={4}
      />
    </div>
  );
};
