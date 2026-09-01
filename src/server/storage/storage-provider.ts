export interface StoredObject {
  key: string;
  contentType: string;
  size: number;
  checksum?: string;
}

export interface StorageProvider {
  put(key: string, content: Uint8Array, contentType: string): Promise<StoredObject>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
