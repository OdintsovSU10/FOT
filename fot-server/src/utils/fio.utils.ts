/**
 * Парсинг ФИО на отдельные части: Фамилия, Имя, Отчество.
 * Формат: "Фамилия Имя Отчество"
 */

export interface IParsedFIO {
  lastName: string;
  firstName: string | null;
  middleName: string | null;
}

export const parseFIO = (fullName: string): IParsedFIO => {
  const parts = fullName.trim().split(/\s+/);
  return {
    lastName: parts[0] || fullName.trim(),
    firstName: parts[1] || null,
    middleName: parts.length > 2 ? parts.slice(2).join(' ') : null,
  };
};
