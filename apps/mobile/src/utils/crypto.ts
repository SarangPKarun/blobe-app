import sodium from 'libsodium-wrappers';
import * as Keychain from 'react-native-keychain';

const KEYPAIR_SERVICE = 'blobe_chat_keypair';

async function ready(): Promise<void> {
  await sodium.ready;
}

export async function getOrCreateKeypair(): Promise<{ publicKey: string; privateKey: string }> {
  await ready();
  const existing = await Keychain.getGenericPassword({ service: KEYPAIR_SERVICE });
  if (existing) {
    return { publicKey: existing.username, privateKey: existing.password };
  }

  const keypair = sodium.crypto_box_keypair();
  const publicKey = sodium.to_base64(keypair.publicKey);
  const privateKey = sodium.to_base64(keypair.privateKey);

  await Keychain.setGenericPassword(publicKey, privateKey, { service: KEYPAIR_SERVICE });
  return { publicKey, privateKey };
}

export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  myPrivateKeyB64: string,
): Promise<{ encryptedContent: string; iv: string }> {
  await ready();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_box_easy(
    sodium.from_string(plaintext),
    nonce,
    sodium.from_base64(recipientPublicKeyB64),
    sodium.from_base64(myPrivateKeyB64),
  );
  return {
    encryptedContent: sodium.to_base64(ciphertext),
    iv: sodium.to_base64(nonce),
  };
}

export async function decryptMessage(
  encryptedContentB64: string,
  ivB64: string,
  senderPublicKeyB64: string,
  myPrivateKeyB64: string,
): Promise<string> {
  await ready();
  const plaintext = sodium.crypto_box_open_easy(
    sodium.from_base64(encryptedContentB64),
    sodium.from_base64(ivB64),
    sodium.from_base64(senderPublicKeyB64),
    sodium.from_base64(myPrivateKeyB64),
  );
  if (!plaintext) throw new Error('Decryption failed');
  return sodium.to_string(plaintext);
}
