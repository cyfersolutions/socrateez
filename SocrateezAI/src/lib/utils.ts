import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalary(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0';
  return `${value.toLocaleString()}`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '0';
  return value.toLocaleString();
}