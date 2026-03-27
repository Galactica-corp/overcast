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
/**
 * Exact layout expected by `MarkdownComponentRawTransactionWithPermit`.
 */
export declare function renderMarkdownComponentRawTransactionWithPermit(props: MarkdownTxPermitProps): string;
