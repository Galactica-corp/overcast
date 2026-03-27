/** Minimal ERC-20 + StablecoinWrapper ABI for calldata encoding only. */
export declare const erc20ApproveAbi: readonly [{
    readonly type: "function";
    readonly name: "approve";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}];
export declare const stablecoinWrapperAbi: readonly [{
    readonly type: "function";
    readonly name: "bridgeToAztec";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "secretHash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "key";
        readonly type: "bytes32";
    }, {
        readonly name: "index";
        readonly type: "uint256";
    }];
}, {
    readonly type: "function";
    readonly name: "withdrawFromL2ToL1";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "recipient";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "callerOnL1";
        readonly type: "address";
    }, {
        readonly name: "epoch";
        readonly type: "uint256";
    }, {
        readonly name: "leafIndex";
        readonly type: "uint256";
    }, {
        readonly name: "path";
        readonly type: "bytes32[]";
    }];
    readonly outputs: readonly [];
}];
