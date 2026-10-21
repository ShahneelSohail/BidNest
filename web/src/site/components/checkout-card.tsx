'use client';

import { useState } from 'react';
import { cx } from './ui';

export type CardBrand = 'Visa' | 'Mastercard' | 'Amex';

export interface CardValues {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
}

type CardField = keyof CardValues;

const MIN_DIGITS = 15;
const MAX_DIGITS = 16;

export const emptyCard = (name: string): CardValues => ({ number: '', expiry: '', cvc: '', name });

const digitsOf = (value: string) => value.replace(/\D/g, '');

const formatNumber = (value: string) =>
  digitsOf(value)
    .slice(0, MAX_DIGITS)
    .replace(/(.{4})/g, '$1 ')
    .trim();

const formatExpiry = (value: string) => {
  const digits = digitsOf(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
};

const brands: Record<string, CardBrand> = { '4': 'Visa', '5': 'Mastercard', '2': 'Mastercard', '3': 'Amex' };

export const cardBrand = (number: string): CardBrand | null => brands[digitsOf(number)[0]] ?? null;

export const cardLast4 = (number: string) => digitsOf(number).slice(-4);

const passesLuhn = (digits: string) => {
  const sum = [...digits].reverse().reduce((total, char, index) => {
    const digit = Number(char);
    const doubled = index % 2 === 1 ? digit * 2 : digit;
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return sum % 10 === 0;
};

export const cardErrors = (values: CardValues, now = new Date()): Partial<Record<CardField, string>> => {
  const errors: Partial<Record<CardField, string>> = {};
  const digits = digitsOf(values.number);
  if (digits.length < MIN_DIGITS) errors.number = digits ? 'Card number looks too short' : 'Enter your card number';
  else if (!cardBrand(digits)) errors.number = 'We accept Visa, Mastercard and Amex';
  else if (!passesLuhn(digits)) errors.number = 'Check the card number';

  const expiry = values.expiry.match(/^(\d{2})\s?\/\s?(\d{2})$/);
  if (!expiry || Number(expiry[1]) < 1 || Number(expiry[1]) > 12) errors.expiry = 'Use MM / YY';
  else if (2000 + Number(expiry[2]) < now.getFullYear() || (2000 + Number(expiry[2]) === now.getFullYear() && Number(expiry[1]) < now.getMonth() + 1)) errors.expiry = 'This card has expired';

  if (!/^\d{3,4}$/.test(values.cvc)) errors.cvc = '3 or 4 digits';
  if (!values.name.trim()) errors.name = 'Name as it appears on the card';
  return errors;
};

const fields: { key: CardField; label: string; placeholder: string; inputMode: 'numeric' | 'text'; autoComplete: string; span: string; format: (value: string) => string }[] = [
  { key: 'number', label: 'Card number', placeholder: '1234 5678 9012 3456', inputMode: 'numeric', autoComplete: 'cc-number', span: 'col-span-2', format: formatNumber },
  { key: 'expiry', label: 'Expiry', placeholder: 'MM / YY', inputMode: 'numeric', autoComplete: 'cc-exp', span: 'col-span-1', format: formatExpiry },
  { key: 'cvc', label: 'Security code', placeholder: '123', inputMode: 'numeric', autoComplete: 'cc-csc', span: 'col-span-1', format: value => digitsOf(value).slice(0, 4) },
  { key: 'name', label: 'Name on card', placeholder: 'Elena Marsh', inputMode: 'text', autoComplete: 'cc-name', span: 'col-span-2', format: value => value },
];

export const CardForm = ({ values, onChange, showErrors }: { values: CardValues; onChange: (values: CardValues) => void; showErrors: boolean }) => {
  const [blurred, setBlurred] = useState<CardField[]>([]);
  const errors = cardErrors(values);
  const brand = cardBrand(values.number);

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map(field => {
        const error = (showErrors || blurred.includes(field.key)) && errors[field.key];
        return (
          <label key={field.key} className={cx('flex flex-col gap-2', field.span)}>
            <span className={cx('text-[13px]', error ? 'text-danger' : 'text-text-2')}>{field.label}</span>
            <div className="relative">
              <input
                value={values[field.key]}
                onChange={event => onChange({ ...values, [field.key]: field.format(event.target.value) })}
                onBlur={() => setBlurred(current => (current.includes(field.key) ? current : [...current, field.key]))}
                placeholder={field.placeholder}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete}
                aria-invalid={Boolean(error)}
                className={cx('tnum h-12 w-full rounded-[4px] border bg-surface px-3.5 text-[15px] font-medium text-text outline-none transition placeholder:text-muted focus:border-gold-300 focus:shadow-[0_0_0_3px_rgb(231_211_147/0.15)]', error ? 'border-danger' : 'border-line-strong', field.key === 'number' && 'tracking-[0.06em]')}
              />
              {field.key === 'number' && brand && <span className="absolute top-3.5 right-3 text-[11px] font-bold tracking-[0.12em] text-gold-300 uppercase">{brand}</span>}
            </div>
            {error && (
              <span role="alert" className="text-[12.5px] text-danger">
                {error}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
};
