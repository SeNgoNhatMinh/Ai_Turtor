package com.ragapi.service;

import com.ragapi.entity.StudentLlmCredential;
import com.ragapi.entity.StudentLlmUsage;
import com.ragapi.repository.StudentLlmCredentialRepository;
import com.ragapi.repository.StudentLlmUsageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class StudentLlmCredentialService {
    private static final Set<String> PROVIDERS = Set.of("openrouter", "groq", "openai", "nvidia");
    private static final int GCM_TAG_BITS = 128;

    private final StudentLlmCredentialRepository credentialRepository;
    private final StudentLlmUsageRepository usageRepository;
    private final byte[] secret;

    public StudentLlmCredentialService(
            StudentLlmCredentialRepository credentialRepository,
            StudentLlmUsageRepository usageRepository,
            @Value("${security.jwt.secret}") String jwtSecret
    ) {
        this.credentialRepository = credentialRepository;
        this.usageRepository = usageRepository;
        try {
            this.secret = MessageDigest.getInstance("SHA-256").digest(jwtSecret.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new IllegalStateException("Không khởi tạo được bộ mã hóa API key", error);
        }
    }

    public Map<String, Object> status(String userId) {
        return credentialRepository.findById(userId)
                .map(this::statusView)
                .orElseGet(() -> Map.of("configured", false));
    }

    public Map<String, Object> save(String userId, String provider, String model, String apiKey) {
        String safeProvider = requireProvider(provider);
        String safeModel = requireModel(model);
        String safeKey = requireKey(apiKey);
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        StudentLlmCredential credential = StudentLlmCredential.builder()
                .userId(userId)
                .provider(safeProvider)
                .model(safeModel)
                .ciphertext(Base64.getEncoder().encodeToString(encrypt(safeKey, iv)))
                .iv(Base64.getEncoder().encodeToString(iv))
                .updatedAt(LocalDateTime.now())
                .build();
        credentialRepository.save(credential);
        return statusView(credential);
    }

    public void delete(String userId) {
        credentialRepository.deleteById(userId);
    }

    public String resolveKey(String userId, String headerKey) {
        if (headerKey != null && !headerKey.isBlank()) return headerKey.trim();
        StudentLlmCredential credential = credentialRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Chưa cấu hình API key"));
        return decrypt(credential);
    }

    public void recordUsage(String userId, String provider, String model, String status) {
        usageRepository.save(StudentLlmUsage.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .provider(provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT))
                .model(model == null ? "" : model.trim())
                .status(status)
                .createdAt(LocalDateTime.now())
                .build());
    }

    public List<Map<String, Object>> usage(String userId) {
        return usageRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 20)).stream()
                .map(item -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("provider", item.getProvider());
                    row.put("model", item.getModel());
                    row.put("status", item.getStatus());
                    row.put("createdAt", item.getCreatedAt());
                    return row;
                })
                .toList();
    }

    private Map<String, Object> statusView(StudentLlmCredential credential) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("configured", true);
        view.put("provider", credential.getProvider());
        view.put("model", credential.getModel());
        view.put("updatedAt", credential.getUpdatedAt());
        return view;
    }

    private byte[] encrypt(String value, byte[] iv) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(secret, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new IllegalStateException("Không lưu được API key");
        }
    }

    private String decrypt(StudentLlmCredential credential) {
        try {
            byte[] iv = Base64.getDecoder().decode(credential.getIv());
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(secret, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(Base64.getDecoder().decode(credential.getCiphertext())), StandardCharsets.UTF_8);
        } catch (Exception error) {
            throw new IllegalStateException("API key đã lưu không đọc được. Hãy nhập lại key.");
        }
    }

    private String requireProvider(String provider) {
        String value = provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
        if (!PROVIDERS.contains(value)) throw new IllegalArgumentException("Provider không được hỗ trợ");
        return value;
    }

    private String requireModel(String model) {
        String value = model == null ? "" : model.trim();
        if (value.isBlank() || value.length() > 120) throw new IllegalArgumentException("Model không hợp lệ");
        return value;
    }

    private String requireKey(String apiKey) {
        String value = apiKey == null ? "" : apiKey.trim();
        if (value.length() < 8 || value.length() > 400) throw new IllegalArgumentException("API key không hợp lệ");
        return value;
    }
}
