import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { NextRequest } from 'next/server'
import { createGzip } from 'zlib'
import { Readable } from 'stream'

const wildcardDomain = process.env.WILDCARD_DOMAIN ?? 'db.example.com'
const s3Client = new S3Client({ endpoint: process.env.S3_ENDPOINT, forcePathStyle: true })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!req.body) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing request body',
      }),
      {
        status: 400,
      }
    )
  }

  const databaseId = params.id
  const key = `dbs/${databaseId}.tar.gz`

  const gzip = createGzip()
  const body = Readable.from(streamToAsyncIterable(req.body))

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body.pipe(gzip),
    },
  })

  await upload.done()

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        serverName: `${databaseId}.${wildcardDomain}`,
      },
    }),
    { headers: { 'content-type': 'application/json' } }
  )
}

async function* streamToAsyncIterable(stream: ReadableStream) {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}