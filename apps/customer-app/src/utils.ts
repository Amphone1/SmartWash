export function formatKip(amount: number | null | undefined): string {
  return '₭' + (amount ?? 0).toLocaleString('en-US');
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
