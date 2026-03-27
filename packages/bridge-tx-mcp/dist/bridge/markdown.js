function escapeAttr(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
/**
 * Exact layout expected by `MarkdownComponentRawTransactionWithPermit`.
 */
export function renderMarkdownComponentRawTransactionWithPermit(props) {
    const a = (k) => escapeAttr(props[k]);
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
