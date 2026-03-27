import { encodeFunctionData } from 'viem';
import { parseDecimalToBaseUnits } from './amount.js';
import { stablecoinWrapperAbi } from './abis.js';
import { buildWithdrawTransaction } from './build.js';
import { parseMembershipWitnessJson } from './witness.js';
describe('parseMembershipWitnessJson', () => {
    it('throws on invalid JSON', () => {
        expect(() => parseMembershipWitnessJson('not json')).toThrow();
    });
});
describe('parseDecimalToBaseUnits', () => {
    it('parses integer and fractional amounts', () => {
        expect(parseDecimalToBaseUnits('2.0', 18)).toBe(2n * 10n ** 18n);
        expect(parseDecimalToBaseUnits('2.5', 18)).toBe(25n * 10n ** 17n);
        expect(parseDecimalToBaseUnits('1', 6)).toBe(1000000n);
    });
    it('rejects invalid input', () => {
        expect(() => parseDecimalToBaseUnits('1.2.3', 18)).toThrow();
        expect(() => parseDecimalToBaseUnits('-1', 18)).toThrow();
    });
});
/** Fixture from token bridge full-flow integration log (local Anvil). */
const FIXTURE_BRIDGE_TO_AZTEC_DATA = '0x0b16b7000000000000000000000000000000000000000000000000000de0b6b3a7640000004ea5d3284ae6b79e0c609e6aa9e54c5e87ba5a337f87ef4db763a24f64bc52';
const FIXTURE_WITHDRAW_DATA = '0x7d427da90000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc0000000000000000000000000000000000000000000000000853a0d2313c0000000000000000000000000000b0d4afd8879ed9f52b28595d31b441d079b2ca07000000000000000000000000000000000000000000000000000000000000001d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb0007638bb56b6dda2b64b8f76841114ac3a87a1820030e2e16772c4d294879c300efcbdb79553ae6863646bf36441755bc344a9a4af335fadc6659594faa431600089a9d421a82c4a25f7acbebe69e638d5b064fa8a60e018793dcb0be53752c';
describe('calldata fixtures', () => {
    it('matches integration-test bridgeToAztec encoding', () => {
        const amount = 1000000000000000000n;
        const secretHash = '0x004ea5d3284ae6b79e0c609e6aa9e54c5e87ba5a337f87ef4db763a24f64bc52';
        const data = encodeFunctionData({
            abi: stablecoinWrapperAbi,
            functionName: 'bridgeToAztec',
            args: [amount, secretHash],
        });
        expect(data.toLowerCase()).toBe(FIXTURE_BRIDGE_TO_AZTEC_DATA.toLowerCase());
    });
    it('matches integration-test withdrawFromL2ToL1 encoding', () => {
        const witness = {
            root: '0x0000000000000000000000000000000000000000000000000000000000000000',
            leafIndex: '0',
            epochNumber: '29',
            siblingPath: [
                '0x0000000000000000000000000000000000000000000000000000000000000000',
                '0x00f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb',
                '0x0007638bb56b6dda2b64b8f76841114ac3a87a1820030e2e16772c4d294879c3',
                '0x00efcbdb79553ae6863646bf36441755bc344a9a4af335fadc6659594faa4316',
                '0x00089a9d421a82c4a25f7acbebe69e638d5b064fa8a60e018793dcb0be53752c',
            ],
        };
        const result = buildWithdrawTransaction({
            wrapperAddress: '0xb0d4afd8879ed9f52b28595d31b441d079b2ca07',
            userEvmAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            userAztecAddress: '0x00',
            amountDecimal: '0.6',
            chainId: '31337',
            tokenDecimals: 18,
            witnessJson: JSON.stringify(witness),
            callerOnL1: '0xb0d4afd8879ed9f52b28595d31b441d079b2ca07',
        });
        const txData = /txData="(0x[a-fA-F0-9]+)"/.exec(result.markdown)?.[1];
        expect(txData?.toLowerCase()).toBe(FIXTURE_WITHDRAW_DATA.toLowerCase());
    });
});
