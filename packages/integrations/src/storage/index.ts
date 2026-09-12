export interface StorageProvider {
  uploadFile(path: string, buffer: Buffer, contentType: string): Promise<string>
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>
  deleteFile(path: string): Promise<void>
}

export class SupabaseStorageProvider implements StorageProvider {
  private bucket: string
  private supabaseUrl: string
  private serviceKey: string

  constructor() {
    this.bucket = process.env['SUPABASE_STORAGE_BUCKET'] ?? 'fathom-media'
    this.supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
    this.serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
  }

  private get baseUrl() {
    return `${this.supabaseUrl}/storage/v1`
  }

  async uploadFile(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': contentType,
      },
      body: buffer as unknown as BodyInit,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Supabase Storage upload failed ${res.status}: ${err}`)
    }

    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${path}`
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/object/sign/${this.bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Supabase Storage sign failed ${res.status}: ${err}`)
    }

    const data = await res.json() as { signedURL: string }
    return `${this.supabaseUrl}${data.signedURL}`
  }

  async deleteFile(path: string): Promise<void> {
    await fetch(`${this.baseUrl}/object/${this.bucket}/${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
      },
    })
  }
}

export class MockStorageProvider implements StorageProvider {
  async uploadFile(path: string): Promise<string> {
    return `https://mock-storage.example.com/${path}`
  }

  async getSignedUrl(path: string): Promise<string> {
    return `https://mock-storage.example.com/${path}?token=mock-signed`
  }

  async deleteFile(): Promise<void> {}
}

export function getStorageProvider(): StorageProvider {
  if (process.env['USE_MOCK_INTEGRATIONS'] === 'true') {
    return new MockStorageProvider()
  }
  return new SupabaseStorageProvider()
}
