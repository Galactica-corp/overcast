import { AztecAddress } from '@aztec/aztec.js/addresses';
import { jest } from '@jest/globals';

describe('FPC utility (env selection)', () => {
    beforeEach(() => {
        jest.resetModules();
        delete process.env.AZTEC_ENV;
        delete process.env.PRIVATE_FPC_SALT;
    });

    it('treats AZTEC_ENV=testnet as non-mainnet', async () => {
        process.env.AZTEC_ENV = 'testnet';
        const mod = await import('../utils/fpc.js');
        expect(mod.isAztecMainnetEnv()).toBe(false);
    });

    it('treats AZTEC_ENV=mainnet as mainnet', async () => {
        process.env.AZTEC_ENV = 'mainnet';
        const mod = await import('../utils/fpc.js');
        expect(mod.isAztecMainnetEnv()).toBe(true);
    });

    it('on mainnet, derives PrivateFPC via registerPrivateContract using PRIVATE_FPC_SALT', async () => {
        process.env.AZTEC_ENV = 'mainnet';
        process.env.PRIVATE_FPC_SALT =
            '0x0000000000000000000000000000000000000000000000000000000000000042';

        const fpcAddress = AztecAddress.fromString(
            '0x1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f',
        );

        const registerPrivateContract = jest.fn(async () => ({ address: fpcAddress }));
        const FPCFeePaymentMethod = jest.fn(function (this: unknown, _addr: AztecAddress) {
            return { kind: 'FPCFeePaymentMethod' };
        }) as unknown as new (addr: AztecAddress) => unknown;

        jest.unstable_mockModule('@wonderland/aztec-fee-payment', () => ({
            registerPrivateContract,
            FPCFeePaymentMethod,
        }));

        const wallet = {} as any;
        const mod = await import('../utils/fpc.js');
        const res = await mod.getFeePaymentMethodForTxFees(wallet);

        expect(registerPrivateContract).toHaveBeenCalledTimes(1);
        expect(res.fpcAddress.toString()).toBe(fpcAddress.toString());
        expect((res.paymentMethod as any).kind).toBe('FPCFeePaymentMethod');
    });
});

