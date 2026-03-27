/** Minimal ERC-20 + StablecoinWrapper ABI for calldata encoding only. */
export const erc20ApproveAbi = [
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
];
export const stablecoinWrapperAbi = [
    {
        type: 'function',
        name: 'bridgeToAztec',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'secretHash', type: 'bytes32' },
        ],
        outputs: [
            { name: 'key', type: 'bytes32' },
            { name: 'index', type: 'uint256' },
        ],
    },
    {
        type: 'function',
        name: 'withdrawFromL2ToL1',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'callerOnL1', type: 'address' },
            { name: 'epoch', type: 'uint256' },
            { name: 'leafIndex', type: 'uint256' },
            { name: 'path', type: 'bytes32[]' },
        ],
        outputs: [],
    },
];
