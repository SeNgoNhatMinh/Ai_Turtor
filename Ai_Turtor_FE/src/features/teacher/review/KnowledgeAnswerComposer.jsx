import { useRef, useState } from 'react';
import { Button, Input, message } from 'antd';
import { ImagePlus, X } from 'lucide-react';
import {
  KNOWLEDGE_ANSWER_MAX_LENGTH,
  KNOWLEDGE_IMAGE_ACCEPT,
  KNOWLEDGE_IMAGE_MAX_COUNT,
  KNOWLEDGE_IMAGE_MAX_SIZE_MB,
} from '../../../constants/knowledgeAnswer';
import { knowledgeImagesApi } from '../../../services/knowledgeImagesApi.js';
import KnowledgeImageGallery from './KnowledgeImageGallery';
import SupportRichTextEditor from '../../../components/support/SupportRichTextEditor';
import './KnowledgeAnswerComposer.css';

const isImageFile = (file) => Boolean(file?.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file?.name || ''));

export default function KnowledgeAnswerComposer({
  id,
  label,
  value = '',
  onChange,
  images = [],
  onImagesChange,
  disabled = false,
  required = false,
  rows = 8,
  placeholder = 'Viết câu trả lời học thuật đầy đủ. Có thể dán hoặc tải hình minh họa cho sơ đồ, mô hình...',
  helper = 'Tối đa 20.000 ký tự. PNG, JPG, WEBP hoặc GIF, tối đa 6 ảnh, mỗi ảnh 5 MB.',
  richText = false,
  onSubmit,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(isImageFile);
    if (!incoming.length || disabled) return;
    const remaining = KNOWLEDGE_IMAGE_MAX_COUNT - images.length;
    if (remaining <= 0) {
      message.warning(`Chỉ đính kèm tối đa ${KNOWLEDGE_IMAGE_MAX_COUNT} hình.`);
      return;
    }
    const selected = incoming.slice(0, remaining);
    const tooLarge = selected.find((file) => file.size > KNOWLEDGE_IMAGE_MAX_SIZE_MB * 1024 * 1024);
    if (tooLarge) {
      message.error(`Mỗi hình không vượt quá ${KNOWLEDGE_IMAGE_MAX_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of selected) {
        const saved = await knowledgeImagesApi.upload(file);
        if (!saved.fileId) throw new Error('Upload did not return a file id');
        uploaded.push({
          ...saved,
          previewUrl: URL.createObjectURL(file),
        });
      }
      onImagesChange?.([...images, ...uploaded]);
    } catch (error) {
      message.error(error?.message || 'Không thể tải hình minh họa. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (fileId) => {
    const next = images.filter((item) => item.fileId !== fileId);
    const removed = images.find((item) => item.fileId === fileId);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onImagesChange?.(next);
  };

  return (
    <div className={`knowledge-answer-composer ${isDragging ? 'is-dragging' : ''}`}>
      {label ? (
        richText ? (
          <span id={`${id}-label`} className="knowledge-answer-composer__label">
            {label}
            {required ? <em>Bắt buộc</em> : null}
          </span>
        ) : (
          <label className="knowledge-answer-composer__label" htmlFor={id}>
            {label}
            {required ? <em>Bắt buộc</em> : null}
          </label>
        )
      ) : null}
      <div
        className="knowledge-answer-composer__editor"
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer?.files);
        }}
      >
        {richText ? (
          <SupportRichTextEditor
            id={id}
            ariaLabel={label ? undefined : placeholder}
            ariaLabelledBy={label ? `${id}-label` : undefined}
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            onFiles={addFiles}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={KNOWLEDGE_ANSWER_MAX_LENGTH}
          />
        ) : (
          <Input.TextArea
            id={id}
            aria-label={label}
            value={value}
            rows={rows}
            maxLength={KNOWLEDGE_ANSWER_MAX_LENGTH}
            showCount
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => onChange?.(event.target.value)}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData?.files || []).filter(isImageFile);
              if (!files.length) return;
              event.preventDefault();
              addFiles(files);
            }}
          />
        )}
      </div>
      <div className="knowledge-answer-composer__toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept={KNOWLEDGE_IMAGE_ACCEPT}
          multiple
          hidden
          disabled={disabled || uploading}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          icon={<ImagePlus size={15} />}
          disabled={disabled || uploading || images.length >= KNOWLEDGE_IMAGE_MAX_COUNT}
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Thêm hình minh họa
        </Button>
        <span>{helper}</span>
      </div>
      {images.length > 0 && (
        <div className="knowledge-answer-composer__images">
          {images.map((image) => (
            <div key={image.fileId} className="knowledge-answer-composer__image">
              <KnowledgeImageGallery images={[image]} />
              <button
                type="button"
                className="knowledge-answer-composer__remove"
                aria-label={`Xóa ${image.fileName || 'hình minh họa'}`}
                disabled={disabled}
                onClick={() => removeImage(image.fileId)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
