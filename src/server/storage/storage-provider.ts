export interface StoredObject {
  key: string;
  contentType: string;
  size: number;
  checksum?: string;
}

export interface StorageProvider {
  put(key: string, content: Uint8Array, contentType: string): Promise<StoredObject>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
