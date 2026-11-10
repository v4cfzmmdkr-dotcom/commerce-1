import { S3Client } from "@aws-sdk/client-s3"

let client: S3Client | null = null

export function objectStorageConfigured() {
  return Boolean(
    process.env.STORAGE_ENDPOINT
      && process.env.STORAGE_ACCESS_KEY_ID
      && process.env.STORAGE_SECRET_ACCESS_KEY
      && process.env.STORAGE_BUCKET
      && process.env.STORAGE_PUBLIC_URL,
  )
}

// S3-compatible storage (Neon Object Storage). Vercel reserves the AWS_* names,
// so the credentials use STORAGE_* instead.
export function objectStorage() {
  if (!process.env.STORAGE_ENDPOINT || !process.env.STORAGE_ACCESS_KEY_ID || !process.env.STORAGE_SECRET_ACCESS_KEY) {
    throw new Error("Object storage credentials are not set")
  }
  client ??= new S3Client({
    region: process.env.STORAGE_REGION || "auto",
    endpoint: process.env.STORAGE_ENDPOINT,
    forcePathStyle: true,
    // Presigned uploads would otherwise carry a checksum of an empty body.
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    },
  })
  return client
}

export function printFilesBucket() {
  const bucket = process.env.STORAGE_PRINT_FILES_BUCKET
  if (!bucket) throw new Error("Set STORAGE_PRINT_FILES_BUCKET to store print files")
  return bucket
}

// STORAGE_PUBLIC_URL is usually /api/media, which serves the image bucket
// through this site so the CDN can cache it; a full origin also works.
export function publicObjectUrl(objectPath: string) {
  const base = process.env.STORAGE_PUBLIC_URL!.replace(/\/+$/, "")
  return `${base}/${objectPath.split("/").map(encodeURIComponent).join("/")}`
}
