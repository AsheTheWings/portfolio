'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AssetDropZone } from './AssetDropZone';
import { UploadingAssetItem, type UploadingFile } from './UploadingAssetItem';
import type { FileWithPath } from '../types';

interface AssetUploaderProps {
  show: boolean;
  uploadingFiles: UploadingFile[];
  onFilesAdded: (files: File[]) => Promise<void>;
  onFolderAdded?: (files: FileWithPath[], rootFolderName: string) => Promise<void>;
  onClose: () => void;
  onRemoveFile: (fileId: string) => void;
  onRetryFile: (fileId: string) => void;
}

export function AssetUploader({
  show,
  uploadingFiles,
  onFilesAdded,
  onFolderAdded,
  onClose,
  onRemoveFile,
  onRetryFile,
}: AssetUploaderProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="upload-component flex gap-4 my-4 justify-center"
        >
          {/* Drop zone */}
          <motion.div
            className="flex-shrink-0"
            style={{
              width: uploadingFiles.length > 0 ? '40%' : '34vw',
              maxWidth: '500px',
              minWidth: '320px',
              aspectRatio: '16 / 9',
            }}
            layout
            transition={{ duration: 0.3 }}
          >
            <AssetDropZone
              onFilesAdded={onFilesAdded}
              onFolderAdded={onFolderAdded}
              onClose={onClose}
              hasUploads={uploadingFiles.length > 0}
              hasErrors={uploadingFiles.some(f => f.status === 'error')}
            />
          </motion.div>

          {/* Upload queue */}
          <AnimatePresence>
            {uploadingFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-y-auto pr-2 scrollbar-inner"
                style={{
                  maxWidth: '500px',
                  maxHeight: 'calc((34vw) * 9 / 16)',
                }}
              >
                <AnimatePresence mode="popLayout">
                  {uploadingFiles.map((file) => (
                    <UploadingAssetItem
                      key={file.id}
                      file={file}
                      onRemove={onRemoveFile}
                      onRetry={onRetryFile}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AssetUploader;
