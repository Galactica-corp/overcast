import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { FPCFeePaymentMethod, registerPrivateContract } from '@wonderland/aztec-fee-payment';
import { getEnv } from '../../config/config.js';
import { getSponsoredFPCInstance } from './sponsored_fpc.js';

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required env var ${name}`);
    }
    return value;
}

export function isAztecMainnetEnv(): boolean {
    return getEnv() === 'mainnet';
}

export async function getFpcAddressForFees(wallet: Wallet): Promise<AztecAddress> {
    if (isAztecMainnetEnv()) {
        const salt = Fr.fromString(requiredEnv('PRIVATE_FPC_SALT'));
        const fpc = await registerPrivateContract(wallet, salt);
        return fpc.address;
    }

    return (await getSponsoredFPCInstance()).address;
}

export async function getFeePaymentMethodForTxFees(
    wallet: Wallet,
): Promise<{
    fpcAddress: Awaited<ReturnType<typeof getFpcAddressForFees>>;
    paymentMethod: SponsoredFeePaymentMethod | FPCFeePaymentMethod;
}> {
    if (isAztecMainnetEnv()) {
        const fpcAddress = await getFpcAddressForFees(wallet);
        return {
            fpcAddress,
            paymentMethod: new FPCFeePaymentMethod(fpcAddress),
        };
    }

    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    return {
        fpcAddress: sponsoredFPC.address,
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredFPC.address),
    };
}

