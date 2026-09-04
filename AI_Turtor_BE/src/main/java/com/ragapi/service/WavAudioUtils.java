package com.ragapi.service;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class WavAudioUtils {

    private WavAudioUtils() {
    }

    static byte[] ensurePcmWav(byte[] audio, int sampleRate) {
        if (audio == null || audio.length == 0) {
            throw new TtsUnavailableException("NVIDIA Magpie returned empty audio");
        }
        if (isWav(audio)) return audio;
        return writeWav(audio, new Format(1, 1, sampleRate, 16));
    }

    static byte[] concatenate(List<byte[]> wavParts) {
        if (wavParts == null || wavParts.isEmpty()) {
            throw new TtsUnavailableException("No TTS audio was generated");
        }
        if (wavParts.size() == 1) return wavParts.get(0);

        List<PcmPart> parts = new ArrayList<>();
        for (byte[] wav : wavParts) parts.add(readPcm(wav));
        Format format = parts.get(0).format();
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        for (PcmPart part : parts) {
            if (!format.equals(part.format())) {
                throw new TtsUnavailableException("TTS chunks returned incompatible audio formats");
            }
            pcm.writeBytes(part.pcm());
        }
        return writeWav(pcm.toByteArray(), format);
    }

    private static boolean isWav(byte[] audio) {
        return audio.length >= 12
                && ascii(audio, 0, "RIFF")
                && ascii(audio, 8, "WAVE");
    }

    private static PcmPart readPcm(byte[] wav) {
        if (!isWav(wav)) throw new TtsUnavailableException("TTS chunk is not a WAV file");
        ByteBuffer buffer = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        int position = 12;
        Format format = null;
        byte[] pcm = null;
        while (position + 8 <= wav.length) {
            String chunkId = new String(wav, position, 4, StandardCharsets.US_ASCII);
            int chunkSize = buffer.getInt(position + 4);
            int dataStart = position + 8;
            if (chunkSize < 0 || dataStart + chunkSize > wav.length) break;
            if ("fmt ".equals(chunkId) && chunkSize >= 16) {
                format = new Format(
                        Short.toUnsignedInt(buffer.getShort(dataStart)),
                        Short.toUnsignedInt(buffer.getShort(dataStart + 2)),
                        buffer.getInt(dataStart + 4),
                        Short.toUnsignedInt(buffer.getShort(dataStart + 14))
                );
            } else if ("data".equals(chunkId)) {
                pcm = new byte[chunkSize];
                System.arraycopy(wav, dataStart, pcm, 0, chunkSize);
            }
            position = dataStart + chunkSize + (chunkSize & 1);
        }
        if (format == null || pcm == null || format.audioFormat() != 1) {
            throw new TtsUnavailableException("TTS returned an unsupported WAV format");
        }
        return new PcmPart(format, pcm);
    }

    private static byte[] writeWav(byte[] pcm, Format format) {
        int bytesPerSample = Math.max(1, format.bitsPerSample() / 8);
        int blockAlign = format.channels() * bytesPerSample;
        int byteRate = format.sampleRate() * blockAlign;
        ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        header.put("RIFF".getBytes(StandardCharsets.US_ASCII));
        header.putInt(36 + pcm.length);
        header.put("WAVE".getBytes(StandardCharsets.US_ASCII));
        header.put("fmt ".getBytes(StandardCharsets.US_ASCII));
        header.putInt(16);
        header.putShort((short) format.audioFormat());
        header.putShort((short) format.channels());
        header.putInt(format.sampleRate());
        header.putInt(byteRate);
        header.putShort((short) blockAlign);
        header.putShort((short) format.bitsPerSample());
        header.put("data".getBytes(StandardCharsets.US_ASCII));
        header.putInt(pcm.length);
        ByteArrayOutputStream output = new ByteArrayOutputStream(44 + pcm.length);
        output.writeBytes(header.array());
        output.writeBytes(pcm);
        return output.toByteArray();
    }

    private static boolean ascii(byte[] value, int offset, String expected) {
        if (value.length < offset + expected.length()) return false;
        for (int index = 0; index < expected.length(); index++) {
            if (value[offset + index] != expected.charAt(index)) return false;
        }
        return true;
    }

    private record Format(int audioFormat, int channels, int sampleRate, int bitsPerSample) {
    }

    private record PcmPart(Format format, byte[] pcm) {
    }
}
