import { SERV_ROOT } from "../consts";
import { packUUID } from "../packages/uuid";
import { fetch } from "./core";

type PresignResponse = Record<string, {
    upUrl: string;
    filePath: string;
}>;

export const uploadEventImage = async (
    file: File,
) => {
    const url = `${SERV_ROOT}/api/upload/event_image`;
    return uploadFiles(url, [file]);
};

export const uploadQrLogo = async (
    file: File,
) => {
    const url = `${SERV_ROOT}/api/upload/qr_logo`;
    return uploadFiles(url, [file]);
};

/**
 * Upload files as a guest participant
 * @param eventUid - UID of the event
 * @param utype - Upload type: 'photo', 'video', or 'voice'
 * @param files - Array of File objects to upload
 * @returns Array of final S3 file paths
 */
export const guestUpload = async (
    eventUid: string,
    utype: string,
    files: File[]
) => {
    const eventPackedUid = packUUID(eventUid);
    const url = `${SERV_ROOT}/api/guest/upload/${eventPackedUid}/${utype}`;

    return uploadFiles(url, files);
}

/**
 * Upload files to S3 via presigned URLs
 * @param url - Presign endpoint URL
 * @param files - Array of File objects to upload
 * @returns Array of final S3 file paths
 */
export const uploadFiles = async (
    url: string,
    files: File[]
): Promise<string[]> => {
    const filenames = files.map(f => f.name);
    // 1. Request presigned URLs from the server
    const presignRes = await fetch(
        url,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(filenames),
        }
    );

    const presignData: PresignResponse = await presignRes.json();

    // 2. Upload each file directly to S3 using presigned URLs
    await Promise.all(
        files.map(async (file) => {
            const presign = presignData[file.name];
            if (!presign) {
                throw new Error(`No presigned URL for ${file.name}`);
            }

            const uploadRes = await window.fetch(presign.upUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type || "application/octet-stream",
                },
            });

            if (!uploadRes.ok) {
                throw new Error(`Upload failed for ${file.name}: ${uploadRes.status}`);
            }
        })
    );

    // 3. Return the final S3 URLs
    return filenames.map(fname => presignData[fname].filePath);
};

