import { useCallback, useEffect, useRef, useState } from 'react';

const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const speechErrorMessages = {
  'audio-capture': 'Không tìm thấy microphone. Hãy kiểm tra thiết bị âm thanh.',
  network: 'Không thể nhận dạng giọng nói do lỗi mạng.',
  'no-speech': 'Không nghe thấy giọng nói. Hãy thử lại và nói gần microphone hơn.',
  'not-allowed': 'Trình duyệt chưa được cấp quyền sử dụng microphone.',
  'service-not-allowed': 'Dịch vụ nhận dạng giọng nói đang bị chặn trên trình duyệt.',
};

export function useSpeechToText({ disabled = false, language = 'vi-VN', onError, onTranscript }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const onErrorRef = useRef(onError);
  const onTranscriptRef = useRef(onTranscript);
  const isSupported = Boolean(getSpeechRecognitionConstructor());

  useEffect(() => {
    onErrorRef.current = onError;
    onTranscriptRef.current = onTranscript;
  }, [onError, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop?.();
  }, []);

  const cancelListening = useCallback(() => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (disabled || isListening) return false;
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      onErrorRef.current?.('Trình duyệt này chưa hỗ trợ nhập bằng giọng nói.');
      return false;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (transcript) onTranscriptRef.current?.(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event?.error !== 'aborted') {
        onErrorRef.current?.(
          speechErrorMessages[event?.error]
          || 'Không thể nhận dạng giọng nói. Hãy thử lại.',
        );
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      onErrorRef.current?.('Không thể khởi động microphone. Hãy thử lại.');
      return false;
    }
  }, [disabled, isListening, language]);

  useEffect(() => {
    if (disabled && recognitionRef.current) cancelListening();
  }, [cancelListening, disabled]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
  }, []);

  return {
    cancelListening,
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
