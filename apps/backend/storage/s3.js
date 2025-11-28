const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

function enabled() {
  return (process.env.STORAGE || '').toLowerCase() === 's3';
}

function client() {
  return new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
}

async function uploadFile(sessionId, name, localPath) {
  const bucket = process.env.AWS_S3_BUCKET;
  const Key = `sessions/${sessionId}/${name}`;
  const Body = fs.createReadStream(localPath);
  const c = client();
  await c.send(new PutObjectCommand({ Bucket: bucket, Key, Body }));
}

async function signedUrl(sessionId, name, expires = 3600) {
  const bucket = process.env.AWS_S3_BUCKET;
  const Key = `sessions/${sessionId}/${name}`;
  const c = client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key });
  return await getSignedUrl(c, cmd, { expiresIn: expires });
}

async function moveLocalSession(dir, sessionId) {
  const files = fs.readdirSync(dir).filter(Boolean);
  for (const f of files) {
    const p = path.join(dir, f);
    await uploadFile(sessionId, f, p);
  }
}

module.exports = { enabled, uploadFile, signedUrl, moveLocalSession };

