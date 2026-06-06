import crypto from 'crypto';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3_ACCESS_KEY, S3_SECRET_KEY, S3_API, S3_PRIVATE_BUCKET, S3_PUBLIC_BUCKET, S3_REGION } from '../env_var';

const s3Client = new S3Client({
  region: S3_REGION || "auto",
  endpoint: S3_API,
  credentials: {
    accessKeyId: S3_ACCESS_KEY || "",
    secretAccessKey: S3_SECRET_KEY || "",
  },
});

const generateSignedUrl = async (key: string, Bucket: string, expiresIn: number = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.log('Error generating signed URL:', error);
    return null;
  }
};

const getS3PublicUrl = (key: string) => {
  if (!key) return null;
  // Fallback if not configured for public domain, though returning API endpoint usually requires it to be public
  return `${S3_API}/${S3_PUBLIC_BUCKET || 'public'}/${key}`;
};

const helperUpload = async (
  { prefix, Body, contentType, Bucket }: { prefix: string, Body: any, contentType: string, Bucket: string }
) => {
  try {
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const fileName = `${crypto.randomUUID()}`;
    const key = path.posix.join(normalizedPrefix, fileName);

    const command = new PutObjectCommand({
      Bucket,
      Key: key,
      Body,
      ContentType: contentType,
    });

    await s3Client.send(command);

    return {
      Key: key,
      Location: getS3PublicUrl(key),
      ContentType: contentType,
    };
  } catch (error) {
    console.log('Error uploading file to S3:', error);
    return null;
  }
};

const uploadFileToS3 = async (
  { prefix, filePath, contentType, Bucket }: { prefix: string, filePath: string, contentType: string, Bucket: string }
) => {
  try {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    return helperUpload({ prefix, Body: buffer, contentType, Bucket });
  } catch (error) {
    console.log('Error uploading file to S3:', error);
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
    console.log('Error uploading URL to S3:', error);
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

    const copyCommand = new CopyObjectCommand({
      Bucket: S3_PUBLIC_BUCKET,
      CopySource: `${S3_PRIVATE_BUCKET}/${key}`,
      Key: key,
      ContentType: contentType,
    });
    
    await s3Client.send(copyCommand);
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_PRIVATE_BUCKET,
      Key: key,
    });
    
    await s3Client.send(deleteCommand);

    return {
      Key: key,
      Location: getS3PublicUrl(key),
      ContentType: contentType,
    };
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

    const copyCommand = new CopyObjectCommand({
      Bucket: S3_PRIVATE_BUCKET,
      CopySource: `${S3_PUBLIC_BUCKET}/${key}`,
      Key: key,
      ContentType: contentType,
    });
    
    await s3Client.send(copyCommand);
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_PUBLIC_BUCKET,
      Key: key,
    });
    
    await s3Client.send(deleteCommand);

    return {
      Key: key,
      Location: getS3PublicUrl(key),
      ContentType: contentType,
    };
  } catch (error) {
    console.log('Error moving file to private S3:', error);
    return null;
  }
};

const deleteFileFromS3 = async (key: string, Bucket: string) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.log('Error deleting file from S3:', error);
    return null;
  }
};

export { uploadFileToS3, uploadBufferToS3, deleteFileFromS3, uploadUrlToS3, getS3PublicUrl, generateSignedUrl, moveKeyToPublicS3, moveKeyToPrivateS3 };
