"use client";

import { ImagePlus, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/types/locale";
import { MAX_MEDIA_UPLOADS } from "@/types/media";

export type UploadedMedia = {
  id: string;
  file: File;
  preview: string;
};

type Props = {
  items: UploadedMedia[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  locale: Locale;
};

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export function MediaUploader({ items, onAdd, onRemove, disabled, locale }: Props) {
  const ko = locale === "ko";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback(
    (files: FileList | File[]) => {
      const valid = Array.from(files).filter((file) => acceptedTypes.includes(file.type));
      if (valid.length) onAdd(valid);
    },
    [onAdd],
  );

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (disabled) return;

      const pastedImages = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && acceptedTypes.includes(item.type))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
        .map((file) => {
          const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
          return new File([file], `pasted-${crypto.randomUUID()}.${extension}`, {
            type: file.type,
            lastModified: Date.now(),
          });
        });

      if (!pastedImages.length) return;
      event.preventDefault();
      accept(pastedImages);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [accept, disabled]);

  return (
    <div className="upload-field">
      <button
        type="button"
        className={`upload-dropzone ${dragging ? "is-dragging" : ""}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files);
        }}
      >
        <span className="upload-icon"><UploadCloud size={22} strokeWidth={1.7} /></span>
        <span>
          <strong>{ko ? "사진을 끌어놓거나 선택하세요" : "Drag, drop, or choose your visit photos"}</strong>
          <small>{ko ? `⌘V / Ctrl+V 붙여넣기 · JPG, PNG, WEBP · 최대 ${MAX_MEDIA_UPLOADS}장` : `Paste with ⌘V / Ctrl+V · JPG, PNG, WEBP · Up to ${MAX_MEDIA_UPLOADS}`}</small>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) accept(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {items.length > 0 && (
        <div className="upload-thumbnails" aria-label={ko ? `업로드 사진 ${items.length}장` : `${items.length} uploaded photos`}>
          {items.map((item, index) => (
            <div className="upload-thumbnail" key={item.id}>
              {/* Blob URLs are generated locally and cannot be handled by next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt={ko ? `${index + 1}번째 업로드: ${item.file.name}` : `Upload ${index + 1}: ${item.file.name}`} />
              <span>{String(index + 1).padStart(2, "0")}</span>
              <button
                type="button"
                aria-label={ko ? `${item.file.name} 삭제` : `Remove ${item.file.name}`}
                onClick={() => onRemove(item.id)}
                disabled={disabled}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {items.length < MAX_MEDIA_UPLOADS && (
            <button
              type="button"
              className="upload-more"
              aria-label={ko ? "사진 더 추가" : "Add more photos"}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
