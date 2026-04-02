/**
 * Логирует ошибки Supabase с деталями
 */
export function logSupabaseError(context: string, error: unknown) {
  const obj = typeof error === 'object' && error !== null ? error as Record<string, unknown> : null;
  console.error(`[${context}] Supabase error:`, {
    message: error instanceof Error ? error.message : String(error),
    details: obj?.details,
    hint: obj?.hint,
    code: obj?.code,
  });
}
