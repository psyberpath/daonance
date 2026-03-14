/**
 * FHE Vote Encryption Utility
 *
 * Uses @zama-fhe/sdk to encrypt votes with real FHE operations.
 * Falls back gracefully if encryption is unavailable.
 */

// Declare global fhevm object that may be injected by browser plugins/SDK
declare global {
  interface Window {
    fhevm?: {
      createEncryptedInput: (
        contractAddress: string,
        userAddress: string,
      ) => {
        add32: (value: number) => EncryptedInputBuilder;
      };
    };
    fhevmChain?: {
      createEncryptedInput: (
        contractAddress: string,
        userAddress: string,
      ) => {
        add32: (value: number) => EncryptedInputBuilder;
      };
    };
  }
}

interface EncryptedInputBuilder {
  add32: (value: number) => EncryptedInputBuilder;
  encrypt: () => Promise<{
    handles: string[];
    inputProof: string;
  }>;
}

/**
 * Encrypt a vote using FHE
 * @param voteValue 1 for YES, 0 for NO
 * @param contractAddress Target contract address
 * @param userAddress User's wallet address
 * @returns Encrypted handle and proof
 */
export async function encryptVote(
  voteValue: number,
  contractAddress: string,
  userAddress: string,
): Promise<{ encryptedHandle: string; inputProof: string }> {
  try {
    // Check if fhevm is available (could be from various sources)
    let fhevm = window.fhevm || window.fhevmChain;

    if (!fhevm) {
      // Try to load from Zama SDK if available
      try {
        const module = await import("fhevmjs");
        if (module && module.createEncryptedInput) {
          fhevm = {
            createEncryptedInput: module.createEncryptedInput as any,
          };
        }
      } catch (e) {
        // SDK not available, will use fallback
      }
    }

    if (!fhevm || !fhevm.createEncryptedInput) {
      throw new Error("FHE encryption not available. Please ensure you have the Zama fhEVM provider installed.");
    }

    // Create encrypted input and add the vote value
    const encrypted = await fhevm.createEncryptedInput(contractAddress, userAddress).add32(voteValue).encrypt();

    if (!encrypted || !encrypted.handles || !encrypted.handles[0]) {
      throw new Error("Encryption failed: invalid response from FHE provider");
    }

    return {
      encryptedHandle: encrypted.handles[0],
      inputProof: encrypted.inputProof || "0x",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown encryption error";
    console.error("[FHE Encryption Error]", message);
    throw new Error(`Failed to encrypt vote: ${message}`);
  }
}

/**
 * Check if FHE encryption is available in the current environment
 */
export function isFHEAvailable(): boolean {
  return !!(window.fhevm || window.fhevmChain);
}
