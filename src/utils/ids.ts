let counter = 0;

export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  counter = (counter + 1) % 1000;
  return `${prefix}_${timestamp}_${random}_${counter.toString(36).padStart(2, '0')}`;
}

export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-z0-9_-]+$/i.test(id);
}
