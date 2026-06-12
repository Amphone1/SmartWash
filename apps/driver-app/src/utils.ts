export function formatKip(amount: number): string {
  return '₭' + amount.toLocaleString('en-US');
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
