export interface MarkdownTxPermitProps {
  txTo: string;
  txGas: string;
  txData: string;
  txFrom: string;
  txValue: string;
  permitSymbol: string;
  permitTo: string;
  permitToken: string;
  permitValue: string;
  chainId: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Exact layout expected by `MarkdownComponentRawTransactionWithPermit`.
 */
export function renderMarkdownComponentRawTransactionWithPermit(
  props: MarkdownTxPermitProps,
): string {
  const a = (k: keyof MarkdownTxPermitProps) => escapeAttr(props[k]);
  return [
    `<MarkdownComponentRawTransactionWithPermit`,
    `  txTo="${a('txTo')}"`,
    `  txGas="${a('txGas')}"`,
    `  txData="${a('txData')}"`,
    `  txFrom="${a('txFrom')}"`,
    `  txValue="${a('txValue')}"`,
    `  permitSymbol="${a('permitSymbol')}"`,
    `  permitTo="${a('permitTo')}"`,
    `  permitToken="${a('permitToken')}"`,
    `  permitValue="${a('permitValue')}"`,
    `  chainId="${a('chainId')}"`,
    `/>`,
  ].join('\n');
}
