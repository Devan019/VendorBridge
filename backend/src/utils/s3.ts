import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {  S3_PUBLIC_BUCKET, S3_PRIVATE_BUCKET } from '../env_var';

const S3_ROOT = path.join(process.cwd(), 'uploads', 's3');

function ensureDirSync(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function bucketPath(bucket: string) {
  const safeBucket = bucket || 'default';
  const dirPath = path.join(S3_ROOT, safeBucket);
  ensureDirSync(dirPath);
  return dirPath;
}

function keyPath(bucket: string, key: string) {
  return path.join(bucketPath(bucket), key);
}

function publicUrlForBucket(bucket: string, key: string) {
  const bucketName = bucket || 'public';
  const normalizedKey = key.replace(/\\/g, '/');
  return `/uploads/s3/${bucketName}/${normalizedKey}`;
}

const generateSignedUrl = async (key: string, Bucket: string, _expiresIn: number = 3600) => {
  try {
    return publicUrlForBucket(Bucket, key);
  } catch (error) {
    console.log('Error generating signed URL:', error);
    return null;
  }
};

const helperUpload = async (
  { prefix, Body, contentType, Bucket }: { prefix: string, Body: any, contentType: string, Bucket: string }
) => {
  try {
    const bucketDir = bucketPath(Bucket);
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const targetDir = path.join(bucketDir, normalizedPrefix);
    ensureDirSync(targetDir);

    const fileName = `${crypto.randomUUID()}`;
    const key = path.posix.join(normalizedPrefix, fileName);
    const destination = path.join(bucketDir, key);
    ensureDirSync(path.dirname(destination));

    if (typeof Body?.pipe === 'function') {
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(destination);
        Body.pipe(writeStream);
        Body.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => resolve());
      });
    } else if (Buffer.isBuffer(Body)) {
      await fsp.writeFile(destination, Body);
    } else if (typeof Body === 'string') {
      await fsp.copyFile(Body, destination);
    } else {
      await fsp.writeFile(destination, Buffer.from(String(Body ?? '')));
    }

    return {
      Key: key,
      Location: publicUrlForBucket(Bucket, key),
      ContentType: contentType,
    };
  } catch (error) {
    console.log('Error uploading file to local S3 helper:', error);
    return null;
  }
};

const getS3PublicUrl = (key: string) => {
  if (!key) return null;
  const bucket = S3_PUBLIC_BUCKET || 'public';
  return publicUrlForBucket(bucket, key);
};

const uploadFileToS3 = async (
  { prefix, filePath, contentType, Bucket }: { prefix: string, filePath: string, contentType: string, Bucket: string }
) => {
  try {
    const buffer = await fsp.readFile(filePath);
    return helperUpload({ prefix, Body: buffer, contentType, Bucket });
  } catch (error) {
    console.log('Error uploading file to local S3 helper:', error);
    return null;
  }
};

const uploadUrlToS3 = async (
  { prefix, url, contentType, Bucket }: { prefix: string, url: string, contentType: string, Bucket: string }
) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return helperUpload({ prefix, Body: buffer, contentType, Bucket });
  } catch (error) {
    console.log('Error uploading URL to local S3 helper:', error);
    return null;
  }
};

const uploadBufferToS3 = async (
  { prefix, buffer, contentType, Bucket }: { prefix: string, buffer: Buffer, contentType: string, Bucket: string }
) => {
  return helperUpload({ prefix, Body: buffer, contentType, Bucket });
};

const moveKeyToPublicS3 = async ({ key, contentType }: { key: string, contentType: string }) => {
  try {
    if (!S3_PRIVATE_BUCKET || !S3_PUBLIC_BUCKET) {
      throw new Error('S3_PRIVATE_BUCKET and S3_PUBLIC_BUCKET must be defined');
    }

    const sourcePath = keyPath(S3_PRIVATE_BUCKET, key);
    const buffer = await fsp.readFile(sourcePath);

    return helperUpload({
      prefix: path.posix.dirname(key),
      Body: buffer,
      contentType,
      Bucket: S3_PUBLIC_BUCKET,
    });
  } catch (error) {
    console.log('Error moving file to public S3:', error);
    return null;
  }
};

const moveKeyToPrivateS3 = async ({ key, contentType }: { key: string, contentType: string }) => {
  try {
    if (!S3_PRIVATE_BUCKET || !S3_PUBLIC_BUCKET) {
      throw new Error('S3_PRIVATE_BUCKET and S3_PUBLIC_BUCKET must be defined');
    }

    const sourcePath = keyPath(S3_PUBLIC_BUCKET, key);
    const buffer = await fsp.readFile(sourcePath);

    return helperUpload({
      prefix: path.posix.dirname(key),
      Body: buffer,
      contentType,
      Bucket: S3_PRIVATE_BUCKET,
    });
  } catch (error) {
    console.log('Error moving file to private S3:', error);
    return null;
  }
};

const deleteFileFromS3 = async (key: string, Bucket: string) => {
  try {
    const filePath = keyPath(Bucket, key);
    await fsp.unlink(filePath);
  } catch (error) {
    console.log('Error deleting file from local S3 helper:', error);
    return null;
  }
};

export { uploadFileToS3, uploadBufferToS3, deleteFileFromS3, uploadUrlToS3, getS3PublicUrl, generateSignedUrl, moveKeyToPublicS3, moveKeyToPrivateS3 };
