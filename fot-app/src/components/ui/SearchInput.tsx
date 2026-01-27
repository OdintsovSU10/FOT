import type { FC, InputHTMLAttributes } from 'react';
import styles from './SearchInput.module.css';
import { SearchIcon } from './Icons';

interface ISearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export const SearchInput: FC<ISearchInputProps> = ({
  value,
  onValueChange,
  placeholder = 'Поиск...',
  ...props
}) => (
  <div className={styles.wrapper}>
    <SearchIcon className={styles.icon} />
    <input
      type="text"
      className={styles.input}
      value={value}
      onChange={e => onValueChange(e.target.value)}
      placeholder={placeholder}
      {...props}
    />
  </div>
);
