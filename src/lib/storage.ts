/**
 * ZBS File Storage Utility
 * Handles file uploads to Supabase Storage with fallback to base64
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseClient: any = null;

function getSupabaseClient() {
  if (!supabaseClient && supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
  fileSize?: number;
}

export interface FileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  uploadedBy: string;
  description?: string;
}

/**
 * Upload a file to Supabase Storage
 * @param bucket - Storage bucket name (e.g., 'insurance-documents')
 * @param filePath - Path within the bucket (e.g., 'tenant123/claim456/document.pdf')
 * @param file - File object or Buffer
 * @param options - Upload options (contentType, upsert)
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  file: File | Buffer | Uint8Array,
  options: { contentType?: string; upsert?: boolean } = {}
): Promise<UploadResult> {
  const client = getSupabaseClient();
  
  if (!client) {
    // Fallback: return base64 data URL
    if (file instanceof File) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      return {
        success: true,
        url: `data:${file.type};base64,${base64}`,
        fileSize: file.size,
      };
    }
    return { success: false, error: 'Supabase client not configured and file is not a File object' };
  }

  try {
    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: options.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
        upsert: options.upsert || false,
      });

    if (error) {
      // Try fallback to base64
      if (file instanceof File) {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        return {
          success: true,
          url: `data:${file.type};base64,${base64}`,
          fileSize: file.size,
        };
      }
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = client.storage.from(bucket).getPublicUrl(data.path);
    
    return {
      success: true,
      url: urlData?.publicUrl,
      path: data.path,
      fileSize: file instanceof File ? file.size : (file as Buffer).length,
    };
  } catch (error: any) {
    // Fallback to base64 for File objects
    if (file instanceof File) {
      try {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        return {
          success: true,
          url: `data:${file.type};base64,${base64}`,
          fileSize: file.size,
        };
      } catch {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: error.message };
  }
}

/**
 * Upload an insurance claim document
 * Organizes files by tenant > claim > category
 */
export async function uploadClaimDocument(
  tenantId: string,
  claimId: string,
  file: File,
  category: string,
  uploadedBy: string,
  description?: string
): Promise<UploadResult & { metadata: FileMetadata }> {
  const ext = file.name.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${tenantId}/claims/${claimId}/${category}/${timestamp}_${safeFileName}`;

  const result = await uploadFile('insurance-documents', filePath, file);

  return {
    ...result,
    metadata: {
      fileName: file.name,
      fileType: ext,
      fileSize: file.size,
      category,
      uploadedBy,
      description,
    },
  };
}

/**
 * Upload an insured portal document
 */
export async function uploadPortalDocument(
  tenantId: string,
  insuredId: string,
  claimId: string,
  file: File,
  category: string,
  description?: string
): Promise<UploadResult & { metadata: FileMetadata }> {
  return uploadClaimDocument(tenantId, claimId, file, category, `portal:${insuredId}`, description);
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: string, filePaths: string[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.storage.from(bucket).remove(filePaths);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Generate a signed URL for private file access (expires in 1 hour)
 */
export async function getSignedUrl(bucket: string, filePath: string, expiresIn: number = 3600): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    return error ? null : data?.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Ensure a storage bucket exists (creates if not)
 */
export async function ensureBucket(bucketName: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Try to get the bucket
    const { data } = await client.storage.getBucket(bucketName);
    if (data) return true;
    
    // Create if doesn't exist
    const { error } = await client.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
