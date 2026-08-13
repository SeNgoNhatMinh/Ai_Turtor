package com.ragapi.service;

import com.ragapi.dto.UpdateUserProfileRequest;
import com.ragapi.dto.UserLoginRequest;
import com.ragapi.dto.UserLoginResponse;
import com.ragapi.dto.UserRegisterRequest;
import com.ragapi.dto.UserRegisterResponse;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.User;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@AllArgsConstructor
public class UserService {

    private UserRepository userRepository;
    private MentorRepository mentorRepository;
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public UserRegisterResponse register(UserRegisterRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new RuntimeException("Email kh\u00f4ng \u0111\u01b0\u1ee3c tr\u1ed1ng");
        }
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new RuntimeException("Password ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 6 k\u00fd t\u1ef1");
        }
        if (request.getFullName() == null || request.getFullName().isBlank()) {
            throw new RuntimeException("T\u00ean \u0111\u1ea7y \u0111\u1ee7 kh\u00f4ng \u0111\u01b0\u1ee3c tr\u1ed1ng");
        }

        String email = request.getEmail().trim();
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email \u0111\u00e3 \u0111\u01b0\u1ee3c \u0111\u0103ng k\u00fd");
        }

        LocalDateTime now = LocalDateTime.now();
        User user = User.builder()
                .id(UUID.randomUUID().toString())
                .email(email)
                .password(hashPassword(request.getPassword()))
                .fullName(request.getFullName().trim())
                .phone(trimToNull(request.getPhone()))
                .isActive(true)
                .isEmailVerified(false)
                .role("STUDENT")
                .createdAt(now)
                .updatedAt(now)
                .build();

        user = userRepository.save(user);
        log.info("User registered: {}", user.getEmail());

        return UserRegisterResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .message("\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng! B\u00e2y gi\u1edd b\u1ea1n c\u00f3 th\u1ec3 \u0111\u0103ng nh\u1eadp")
                .token(jwtService.generateToken(user))
                .build();
    }

    public UserLoginResponse login(UserLoginRequest request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            throw new RuntimeException("Email v\u00e0 Password kh\u00f4ng \u0111\u01b0\u1ee3c tr\u1ed1ng");
        }

        String email = request.getEmail().trim();
        Optional<User> optUser = userRepository.findByEmailAndIsActiveTrue(email);
        if (optUser.isEmpty()) {
            Optional<Mentor> optMentor = mentorRepository.findByEmail(email);
            if (optMentor.isPresent() && (optMentor.get().getIsActive() == null || optMentor.get().getIsActive())) {
                Mentor mentor = optMentor.get();
                if (request.getPassword().equals(mentor.getPhone())) {
                    return UserLoginResponse.builder()
                            .userId(mentor.getId())
                            .email(mentor.getEmail())
                            .fullName(mentor.getMentorName())
                            .avatarUrl(mentor.getAvatarUrl())
                            .role("TEACHER")
                            .message("\u0110\u0103ng nh\u1eadp th\u00e0nh c\u00f4ng (Mentor)")
                            .token(jwtService.generateToken(mentor.getId(), mentor.getEmail(), mentor.getMentorName(), "TEACHER"))
                            .build();
                }
            }
            throw new RuntimeException("Email ho\u1eb7c Password kh\u00f4ng ch\u00ednh x\u00e1c");
        }

        User user = optUser.get();
        if (!verifyPassword(request.getPassword(), user.getPassword())) {
            if (user.getPassword() != null && user.getPassword().equals(request.getPassword())) {
                user.setPassword(hashPassword(request.getPassword()));
                log.info("Upgraded plain password to BCrypt hash for imported/seeded user: {}", user.getEmail());
            } else {
                throw new RuntimeException("Email ho\u1eb7c Password kh\u00f4ng ch\u00ednh x\u00e1c");
            }
        }

        user.setLastLoginAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("User logged in: {}", user.getEmail());

        return UserLoginResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .message("\u0110\u0103ng nh\u1eadp th\u00e0nh c\u00f4ng")
                .token(jwtService.generateToken(user))
                .build();
    }

    public void changePassword(String userId, String currentPassword, String newPassword) {
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("currentPassword is required");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("newPassword is required");
        }
        if (newPassword.length() < 6) {
            throw new IllegalArgumentException("newPassword must be at least 6 characters");
        }

        User user = getUserById(userId);
        boolean currentPasswordMatches = verifyPassword(currentPassword, user.getPassword())
                || (user.getPassword() != null && user.getPassword().equals(currentPassword));
        if (!currentPasswordMatches) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPassword(hashPassword(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("Password changed for user: {}", user.getEmail());
    }
    public User getUserById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Kh\u00f4ng t\u00ecm th\u1ea5y ng\u01b0\u1eddi d\u00f9ng"));
    }

    public User updateProfile(String userId, UpdateUserProfileRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        User user = getUserById(userId);
        if (request.getFullName() != null) {
            if (request.getFullName().isBlank()) {
                throw new IllegalArgumentException("fullName must not be blank");
            }
            user.setFullName(request.getFullName().trim());
        }
        if (request.getPhone() != null) {
            user.setPhone(trimToNull(request.getPhone()));
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(trimToNull(request.getAvatarUrl()));
        }
        if (request.getBio() != null) {
            user.setBio(trimToNull(request.getBio()));
        }
        if (request.getAddress() != null) {
            user.setAddress(trimToNull(request.getAddress()));
        }
        if (request.getCity() != null) {
            user.setCity(trimToNull(request.getCity()));
        }
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    private String hashPassword(String password) {
        return passwordEncoder.encode(password);
    }

    private boolean verifyPassword(String plainPassword, String hashedPassword) {
        return passwordEncoder.matches(plainPassword, hashedPassword);
    }

    public void validateUserPassword(String userId, String password) {
        User user = getUserById(userId);
        if (!verifyPassword(password, user.getPassword())) {
            throw new RuntimeException("M\u1eadt kh\u1ea9u kh\u00f4ng h\u1ee3p l\u1ec7");
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}


