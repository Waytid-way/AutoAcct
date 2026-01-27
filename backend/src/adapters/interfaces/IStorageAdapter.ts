// backend/src/adapters/interfaces/IStorageAdapter.ts

import { IAdapter, IAdapterConfig, IAdapterHealthCheck } from './IAdapter';

/**
 * STORAGE ADAPTER INTERFACE
 *
 * Implementations:
 * - GoogleDriveAdapter (production)
 * - LocalStorageAdapter (dev mode)
 */

export interface IStorageFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl?: string;
  uploadedAt: Date;
}

export interface IStorageAdapter extends IAdapter {
  /**
   * Upload file to storage
   */
  uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: {
      folderId?: string;
      public?: boolean;
    }
  ): Promise<IStorageFile>;

  /**
   * Download file from storage
   */
  downloadFile(fileId: string): Promise<Buffer>;

  /**
   * Delete file from storage
   */
  deleteFile(fileId: string): Promise<void>;

  /**
   * Get file metadata
   */
  getFileInfo(fileId: string): Promise<IStorageFile>;

  /**
   * List files in folder
   */
  listFiles(folderId?: string): Promise<IStorageFile[]>;
}

/**
 * LOCAL STORAGE ADAPTER (for DEV mode)
 */
export class LocalStorageAdapter implements IStorageAdapter {
  readonly name = 'LocalStorage';
  readonly config: IAdapterConfig;
  private storageDir: string;

  constructor(config?: Partial<IAdapterConfig> & { storageDir?: string }) {
    this.config = {
      mode: 'dev',
      timeout: 1000,
      ...config,
    };
    this.storageDir = config?.storageDir || './dev-storage';
  }

  async initialize(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }

    console.log('[LocalStorage] Initialized (DEV mode):', this.storageDir);
  }

  async healthCheck(): Promise<IAdapterHealthCheck> {
    const fs = await import('fs/promises');

    try {
      await fs.access(this.storageDir);
      return {
        isHealthy: true,
        latencyMs: 5,
        lastCheckedAt: new Date(),
      };
    } catch {
      return {
        isHealthy: false,
        lastCheckedAt: new Date(),
        errorMessage: 'Storage directory not accessible',
      };
    }
  }

  async shutdown(): Promise<void> {
    // No-op for local storage
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: { folderId?: string; public?: boolean }
  ): Promise<IStorageFile> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const crypto = await import('crypto');

    const fileId = crypto.randomUUID();
    const filePath = path.join(this.storageDir, fileId);

    await fs.writeFile(filePath, buffer);

    const file: IStorageFile = {
      fileId,
      fileName,
      mimeType,
      sizeBytes: buffer.length,
      downloadUrl: `file://${filePath}`,
      uploadedAt: new Date(),
    };

    console.log('[LocalStorage] Uploaded:', fileName, '->', fileId);
    return file;
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const filePath = path.join(this.storageDir, fileId);

    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`File not found: ${fileId}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const filePath = path.join(this.storageDir, fileId);

    try {
      await fs.unlink(filePath);
      console.log('[LocalStorage] Deleted:', fileId);
    } catch (error) {
      throw new Error(`File not found: ${fileId}`);
    }
  }

  async getFileInfo(fileId: string): Promise<IStorageFile> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const filePath = path.join(this.storageDir, fileId);

    try {
      const stats = await fs.stat(filePath);
      return {
        fileId,
        fileName: path.basename(fileId), // Simplified
        mimeType: 'application/octet-stream', // Simplified
        sizeBytes: stats.size,
        downloadUrl: `file://${filePath}`,
        uploadedAt: stats.mtime,
      };
    } catch (error) {
      throw new Error(`File not found: ${fileId}`);
    }
  }

  async listFiles(folderId?: string): Promise<IStorageFile[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const files = await fs.readdir(this.storageDir);
      const filePromises = files.map(async (fileId) => {
        return this.getFileInfo(fileId);
      });

      return Promise.all(filePromises);
    } catch (error) {
      return [];
    }
  }
}