// Implementation of the token bridge that can move funds between L1 <> L2.
// The bridge has a corresponding Portal contract on L1 that it is attached to
// And corresponds to a Token on L2 that uses the `AuthWit` accounts pattern.
// Bridge has to be set as a minter on the token before it can be used
// Based on https://github.com/AztecProtocol/aztec-packages/blob/next/noir-projects/noir-contracts/contracts/app/token_bridge_contract/src/main.nr

use aztec::macros::aztec;

#[aztec]
pub contract TokenBridge {
    use aztec::{protocol::address::{AztecAddress, EthAddress}, state_vars::PublicImmutable};

    use token_portal_content_hash_lib::{
        get_mint_to_private_content_hash, get_mint_to_public_content_hash,
        get_withdraw_content_hash,
    };

    use token::PrivateStablecoin;

    use aztec::macros::{functions::{external, initializer, view}, storage::storage};

    // Storage structure, containing all storage, and specifying what slots they use.
    #[storage]
    struct Storage<Context> {
        token: PublicImmutable<AztecAddress, Context>,
        portal: PublicImmutable<EthAddress, Context>,
    }

    // Constructs the contract.
    #[external("public")]
    #[initializer]
    fn constructor(token: AztecAddress, portal: EthAddress) {
        self.storage.token.initialize(token);
        self.storage.portal.initialize(portal);
    }

    #[external("public")]
    #[view]
    fn get_token() -> AztecAddress {
        self.storage.token.read()
    }

    #[external("public")]
    #[view]
    fn get_portal() -> EthAddress {
        self.storage.portal.read()
    }
    
    // Consumes a L1->L2 message and calls the token contract to mint the appropriate amount publicly
    #[external("public")]
    fn claim_public(to: AztecAddress, amount: u128, secret: Field, message_leaf_index: Field) {
        let content_hash = get_mint_to_public_content_hash(to, amount);

        // Consume message and emit nullifier
        self.context.consume_l1_to_l2_message(
            content_hash,
            secret,
            self.storage.portal.read(),
            message_leaf_index,
        );

        // Mint tokens
        self.call(PrivateStablecoin::at(self.storage.token.read()).mint_to_public(to, amount));
    }

    // Burns the appropriate amount of tokens and creates a L2 to L1 withdraw message publicly
    // Requires `msg.sender` to give approval to the bridge to burn tokens on their behalf using witness signatures
    #[external("public")]
    fn exit_to_l1_public(
        recipient: EthAddress, // ethereum address to withdraw to
        amount: u128,
        caller_on_l1: EthAddress, // ethereum address that can call this function on the L1 portal (0x0 if anyone can call)
        authwit_nonce: Field, // nonce used in the approval message by `msg.sender` to let bridge burn their tokens on L2
    ) {
        // Send an L2 to L1 message
        let content = get_withdraw_content_hash(recipient, amount, caller_on_l1);
        self.context.message_portal(self.storage.portal.read(), content);

        // Burn tokens
        self.call(PrivateStablecoin::at(self.storage.token.read()).burn_public(self.msg_sender(), amount, authwit_nonce));
    }

    /// Claims the bridged tokens and makes them accessible in private. Note that recipient's address is not revealed
    /// but the amount is. Hence it's most likely possible to determine to which L1 deposit this claim corresponds to
    /// (unless there are multiple pending deposits of the same amount).
    #[external("private")]
    fn claim_private(
        recipient: AztecAddress, // recipient of the bridged tokens
        amount: u128,
        secret_for_L1_to_L2_message_consumption: Field, // secret used to consume the L1 to L2 message
        message_leaf_index: Field,
    ) {
        // Consume L1 to L2 message and emit nullifier
        let content_hash = get_mint_to_private_content_hash(amount);
        self.context.consume_l1_to_l2_message(
            content_hash,
            secret_for_L1_to_L2_message_consumption,
            self.storage.portal.read(),
            message_leaf_index,
        );

        // At last we mint the tokens
        self.call(PrivateStablecoin::at(self.storage.token.read()).mint_to_private(recipient, amount));
    }

    // Burns the appropriate amount of tokens and creates a L2 to L1 withdraw message privately
    // Requires `msg.sender` (caller of the method) to give approval to the bridge to burn tokens on their behalf using witness signatures
    #[external("private")]
    fn exit_to_l1_private(
        recipient: EthAddress, // ethereum address to withdraw to
        amount: u128,
        caller_on_l1: EthAddress, // ethereum address that can call this function on the L1 portal (0x0 if anyone can call)
        authwit_nonce: Field, // nonce used in the approval message by `msg.sender` to let bridge burn their tokens on L2
    ) {
        // Send an L2 to L1 message
        let content = get_withdraw_content_hash(recipient, amount, caller_on_l1);
        self.context.message_portal(self.storage.portal.read(), content);

        // Burn tokens
        self.call(PrivateStablecoin::at(self.storage.token.read()).burn_private(self.msg_sender(), amount, authwit_nonce));
    }
}