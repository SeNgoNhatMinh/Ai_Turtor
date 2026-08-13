package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MentorSelectionResponse - Response khi user chọn mentor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorSelectionResponse {
    private String chatRoomId; // ID phòng chat vừa tạo
    private String mentorName;
    private String mentorEmail;
    private String message;
}
