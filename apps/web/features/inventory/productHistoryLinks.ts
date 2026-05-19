export function buildProductHistoryHref(productId: number | string | undefined | null, txnType?: string) {
  if (!productId) return null;

  const params = new URLSearchParams();
  params.set("product_id", String(productId));
  if (txnType) params.set("txn_type", txnType);
  return `/inventory/product-history?${params.toString()}`;
}
