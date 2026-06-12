export function formatKip(amount: number): string {
  return '₭' + amount.toLocaleString('en-US');
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ຫາກໍ່';
  if (mins < 60) return `${mins} ນາທີກ່ອນ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ຊົ່ວໂມງກ່ອນ`;
  return `${Math.floor(hours / 24)} ວັນກ່ອນ`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
