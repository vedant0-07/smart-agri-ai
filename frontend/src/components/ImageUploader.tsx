import React from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ImageUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  hint?: string;
  preview?: string | null;
  onClear?: () => void;
  disabled?: boolean;
}

export default function ImageUploader({
  onFileSelect,
  accept = 'image/jpeg,image/jpg,image/png,image/webp,image/bmp',
  maxSizeMB = 10,
  label = 'Upload Image',
  hint = 'JPEG, PNG, WebP or BMP up to 10MB',
  preview,
  onClear,
  disabled = false,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setError(null);
    const allowedTypes = accept.split(',').map(t => t.trim());
    if (!allowedTypes.includes(file.type)) {
      setError(`Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, BMP.`);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${maxSizeMB} MB.`);
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
    e.target.value = '';
  };

  if (preview) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-800 group">
        <img
          src={preview}
          alt="Preview"
          className="w-full max-h-72 object-contain bg-gray-900"
        />
        {onClear && (
          <button
            id="image-clear-btn"
            onClick={onClear}
            disabled={disabled}
            className="absolute top-3 right-3 w-8 h-8 bg-gray-900/90 hover:bg-red-900/90 
                       border border-gray-700 hover:border-red-700 text-gray-300 
                       hover:text-red-300 rounded-lg flex items-center justify-center
                       transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        id="image-upload-zone"
        className={`upload-zone ${dragOver ? 'upload-zone-active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
            ${dragOver ? 'bg-agri-900 border-agri-600' : 'bg-gray-800'} 
            border-2 ${dragOver ? 'border-agri-500' : 'border-gray-700'} transition-colors`}>
            {dragOver ? (
              <Upload className="w-6 h-6 text-agri-400" />
            ) : (
              <ImageIcon className="w-6 h-6 text-gray-500" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-300 text-sm">{label}</p>
            <p className="text-xs text-gray-500 mt-1">
              Drag & drop or <span className="text-agri-400 underline">browse files</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">{hint}</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
          id="image-file-input"
        />
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/30 
                        border border-red-900 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
