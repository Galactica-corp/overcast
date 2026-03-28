import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { encodeFunctionData } from 'viem';

import { parseDecimalToBaseUnits } from './amount.js';
import { stablecoinWrapperAbi } from './abis.js';
import { buildDepositTransaction, buildWithdrawTransaction } from './build.js';
import { parseMembershipWitnessJson } from './witness.js';

/** `bridgeToAztec` selector — must match calldata produced by the deposit path. */
const BRIDGE_TO_AZTEC_SELECTOR = '0x0b16b700';

describe('parseMembershipWitnessJson', () => {
  it('throws on invalid JSON', () => {
    expect(() => parseMembershipWitnessJson('not json')).toThrow();
  });
});

describe('parseDecimalToBaseUnits', () => {
  it('parses integer and fractional amounts', () => {
    expect(parseDecimalToBaseUnits('2.0', 18)).toBe(2n * 10n ** 18n);
    expect(parseDecimalToBaseUnits('2.5', 18)).toBe(25n * 10n ** 17n);
    expect(parseDecimalToBaseUnits('1', 6)).toBe(1_000_000n);
  });

  it('rejects invalid input', () => {
    expect(() => parseDecimalToBaseUnits('1.2.3', 18)).toThrow();
    expect(() => parseDecimalToBaseUnits('-1', 18)).toThrow();
  });
});

/** Fixture from token bridge full-flow integration log (local Anvil). */
const FIXTURE_BRIDGE_TO_AZTEC_DATA =
  '0x0b16b7000000000000000000000000000000000000000000000000000de0b6b3a7640000004ea5d3284ae6b79e0c609e6aa9e54c5e87ba5a337f87ef4db763a24f64bc52';

const FIXTURE_WITHDRAW_DATA =
  '0x7d427da90000000000000000000000003c44cdddb6a900fa2b585dd299e03d12fa4293bc0000000000000000000000000000000000000000000000000853a0d2313c0000000000000000000000000000b0d4afd8879ed9f52b28595d31b441d079b2ca07000000000000000000000000000000000000000000000000000000000000001d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb0007638bb56b6dda2b64b8f76841114ac3a87a1820030e2e16772c4d294879c300efcbdb79553ae6863646bf36441755bc344a9a4af335fadc6659594faa431600089a9d421a82c4a25f7acbebe69e638d5b064fa8a60e018793dcb0be53752c';

describe('calldata fixtures', () => {
  it('matches integration-test bridgeToAztec encoding', () => {
    const amount = 1_000_000_000_000_000_000n;
    const secretHash =
      '0x004ea5d3284ae6b79e0c609e6aa9e54c5e87ba5a337f87ef4db763a24f64bc52' as `0x${string}`;
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

/**
 * Exercises `generateDepositClaimPair` → Poseidon via @aztec/bb.js (native or WASM fallback).
 * Catches missing `bb` binary, broken musl/glibc images, and absent wasm assets.
 */
describe('deposit path smoke', () => {
  jest.setTimeout(120_000);

  afterAll(async () => {
    const { Barretenberg } = await import('@aztec/bb.js');
    await Barretenberg.destroySingleton().catch(() => undefined);
  });

  it('buildDepositTransaction returns consistent markdown, claim data, and calldata', async () => {
    const tokenAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const wrapperAddress = '0xb0d4afd8879ed9f52b28595d31b441d079b2ca07';
    const userEvmAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    const result = await buildDepositTransaction({
      tokenAddress,
      wrapperAddress,
      userEvmAddress,
      userAztecAddress: '0x00',
      amountDecimal: '1.0',
      chainId: '31337',
      tokenDecimals: 18,
      permitSymbol: 'TST',
    });

    const expectedAmountWei = (10n ** 18n).toString();
    expect(result.claimData.claimAmount).toBe(expectedAmountWei);
    expect(result.bridgeArgs.amount).toBe(expectedAmountWei);
    expect(result.claimData.messageHash).toBeUndefined();
    expect(result.claimData.messageLeafIndex).toBeUndefined();

    expect(result.claimData.claimSecret).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(result.bridgeArgs.secretHash).toMatch(/^0x[0-9a-f]{64}$/i);

    expect(result.markdown).toContain(`txTo="${wrapperAddress}"`);
    expect(result.markdown).toContain(`chainId="31337"`);
    expect(result.markdown.toLowerCase()).toContain(BRIDGE_TO_AZTEC_SELECTOR.slice(2));

    const expectedBridgeData = encodeFunctionData({
      abi: stablecoinWrapperAbi,
      functionName: 'bridgeToAztec',
      args: [BigInt(expectedAmountWei), result.bridgeArgs.secretHash as `0x${string}`],
    });
    const bridgeTxData = /txData="(0x[a-fA-F0-9]+)"/.exec(result.markdown)?.[1];
    expect(bridgeTxData?.toLowerCase()).toBe(expectedBridgeData.toLowerCase());

    expect(result.approvalMarkdown).toBeDefined();
    expect(result.approvalMarkdown!).toContain(`txTo="${tokenAddress}"`);
    const approveTxData = /txData="(0x[a-fA-F0-9]+)"/.exec(result.approvalMarkdown!)?.[1];
    expect(approveTxData?.toLowerCase().startsWith('0x095ea7b3')).toBe(true);
  });
});
