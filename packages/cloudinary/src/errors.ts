export class CloudinaryConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CloudinaryConfigError'
  }
}

export class CloudinaryUploadError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'CloudinaryUploadError'
    this.status = status
  }
}
